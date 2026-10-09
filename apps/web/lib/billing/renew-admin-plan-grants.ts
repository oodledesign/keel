import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  adminPlanCycleExpiresAt,
  nextAdminPlanCycle,
} from '~/lib/billing/admin-plan-cycle';
import { mediaTierForPlan } from '~/lib/billing/apply-admin-plan-usage-grants';
import { campaignTierForPlanId } from '~/lib/billing/campaign-pricing';
import {
  grantCampaignCredits,
  updateCampaignCreditPoolMetadata,
} from '~/lib/campaign-credits/ledger';
import { grantMediaCredits } from '~/lib/media-credits/ledger';

type DuePool = {
  accountId: string;
  planId: string;
  cycleEnd: string | null;
};

type RenewalResult = {
  renewed: number;
  failed: Array<{ accountId: string; error: string }>;
};

/**
 * Admin-granted plans (no Stripe subscription) whose pool cycle has ended.
 * Plan id comes from the entitlement metadata, falling back to the pool tier
 * for entitlements granted without a plan apply.
 */
async function listDuePools(
  admin: SupabaseClient,
  input: {
    entitlementKey: string;
    poolTable: string;
    planPrefix: string;
    now: Date;
  },
): Promise<DuePool[]> {
  // Pool tables may be ahead of generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const nowIso = input.now.toISOString();
  const today = nowIso.slice(0, 10);

  const { data: entitlements, error: entitlementsError } = await db
    .from('account_entitlements')
    .select('account_id, metadata')
    .eq('entitlement_key', input.entitlementKey)
    .eq('source', 'admin_grant')
    .is('stripe_subscription_id', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (entitlementsError) throw new Error(entitlementsError.message);

  const planByAccount = new Map<string, string | null>();
  for (const row of (entitlements ?? []) as Array<{
    account_id: string;
    metadata: { planId?: unknown } | null;
  }>) {
    const planId = row.metadata?.planId;
    planByAccount.set(
      row.account_id,
      typeof planId === 'string' && planId.startsWith(input.planPrefix)
        ? planId
        : null,
    );
  }

  if (planByAccount.size === 0) return [];

  const { data: pools, error: poolsError } = await db
    .from(input.poolTable)
    .select('account_id, plan_tier, cycle_end')
    .in('account_id', [...planByAccount.keys()])
    .neq('plan_tier', 'none')
    .or(`cycle_end.is.null,cycle_end.lte.${today}`);

  if (poolsError) throw new Error(poolsError.message);

  return (
    (pools ?? []) as Array<{
      account_id: string;
      plan_tier: string;
      cycle_end: string | null;
    }>
  ).map((pool) => ({
    accountId: pool.account_id,
    planId:
      planByAccount.get(pool.account_id) ??
      `${input.planPrefix}${pool.plan_tier}-monthly`,
    cycleEnd: pool.cycle_end,
  }));
}

async function renewCampaignPlans(
  admin: SupabaseClient,
  now: Date,
): Promise<RenewalResult> {
  const result: RenewalResult = { renewed: 0, failed: [] };
  const due = await listDuePools(admin, {
    entitlementKey: 'addon_campaigns',
    poolTable: 'campaign_credit_pools',
    planPrefix: 'campaigns-',
    now,
  });

  for (const pool of due) {
    const tier = campaignTierForPlanId(pool.planId);
    const cycle = nextAdminPlanCycle(pool.cycleEnd, now);
    if (!tier || !cycle) continue;

    try {
      await grantCampaignCredits(
        pool.accountId,
        tier.sendUnits,
        'monthly_grant',
        adminPlanCycleExpiresAt(cycle.cycleEnd),
        `admin_campaigns:${pool.accountId}:${pool.planId}:${cycle.cycleEnd}`,
      );
      await updateCampaignCreditPoolMetadata(pool.accountId, {
        monthly_allowance: tier.sendUnits,
        plan_tier: tier.planTier,
        cycle_start: cycle.cycleStart,
        cycle_end: cycle.cycleEnd,
      });
      result.renewed += 1;
    } catch (error) {
      result.failed.push({
        accountId: pool.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function renewMediaPlans(
  admin: SupabaseClient,
  now: Date,
): Promise<RenewalResult> {
  const result: RenewalResult = { renewed: 0, failed: [] };
  const due = await listDuePools(admin, {
    entitlementKey: 'addon_media_generate',
    poolTable: 'media_credit_pools',
    planPrefix: 'media-',
    now,
  });

  for (const pool of due) {
    const tier = mediaTierForPlan(pool.planId);
    const cycle = nextAdminPlanCycle(pool.cycleEnd, now);
    if (!tier || !cycle) continue;

    try {
      await grantMediaCredits(
        pool.accountId,
        tier.units,
        'monthly_grant',
        adminPlanCycleExpiresAt(cycle.cycleEnd),
        `admin_media:${pool.accountId}:${pool.planId}:${cycle.cycleEnd}`,
      );
      const { error } = await admin
        .from('media_credit_pools')
        .update({
          monthly_allowance: tier.units,
          plan_tier: tier.planTier,
          cycle_start: cycle.cycleStart,
          cycle_end: cycle.cycleEnd,
          updated_at: now.toISOString(),
        })
        .eq('account_id', pool.accountId);
      if (error) throw new Error(error.message);
      result.renewed += 1;
    } catch (error) {
      result.failed.push({
        accountId: pool.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Stripe renews paid plans on invoice.paid; admin-applied plans have no
 * invoice, so grant each new monthly cycle here. Idempotent per cycle.
 */
export async function renewAdminPlanGrants(
  admin: SupabaseClient,
  now = new Date(),
): Promise<{ campaigns: RenewalResult; media: RenewalResult }> {
  const campaigns = await renewCampaignPlans(admin, now);
  const media = await renewMediaPlans(admin, now);
  return { campaigns, media };
}
