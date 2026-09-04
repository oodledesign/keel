import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { syncAccountCreditLimit } from '~/lib/ai/tiers';
import { campaignTierForPlanId } from '~/lib/billing/campaign-pricing';
import { MEDIA_SUBSCRIPTION_TIERS } from '~/lib/billing/media-unit-pricing';
import {
  type OzerPlanDefinition,
  findPlanByProductAndPlanId,
} from '~/lib/billing/ozer-plan-catalog';
import {
  grantCampaignCredits,
  updateCampaignCreditPoolMetadata,
} from '~/lib/campaign-credits/ledger';
import { grantMediaCredits } from '~/lib/media-credits/ledger';

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function mediaTierForPlan(planId: string): {
  units: number;
  planTier: string;
} | null {
  if (planId.startsWith('media-starter')) {
    return {
      units: MEDIA_SUBSCRIPTION_TIERS[0].units,
      planTier: 'starter',
    };
  }
  if (planId.startsWith('media-studio')) {
    return {
      units: MEDIA_SUBSCRIPTION_TIERS[1].units,
      planTier: 'studio',
    };
  }
  if (planId.startsWith('media-agency')) {
    return {
      units: MEDIA_SUBSCRIPTION_TIERS[2].units,
      planTier: 'agency',
    };
  }
  return null;
}

/**
 * When a super admin applies a tier (typically with billing exempt), attach the
 * matching AI credit pool and/or media unit monthly grant.
 */
export async function applyAdminPlanUsageGrants(
  admin: SupabaseClient,
  accountId: string,
  plan: OzerPlanDefinition,
): Promise<{
  aiCredits: number | null;
  mediaUnits: number | null;
  campaignSendUnits: number | null;
}> {
  let aiCredits: number | null = null;
  let mediaUnits: number | null = null;
  let campaignSendUnits: number | null = null;

  const isAiPlan =
    plan.family === 'business' ||
    plan.family === 'business_starter' ||
    plan.family === 'business_lite' ||
    plan.family === 'commercial_property' ||
    plan.planId.startsWith('business-') ||
    plan.planId.startsWith('commercial-property');

  if (isAiPlan) {
    const synced = await syncAccountCreditLimit(accountId, admin, {
      refillRemaining: true,
    });
    aiCredits = synced.current;
  }

  const media = mediaTierForPlan(plan.planId);
  if (media) {
    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, 1);
    const cycleEndIso = periodEnd.toISOString().slice(0, 10);
    const idempotencyKey = `admin_media:${accountId}:${plan.planId}:${cycleEndIso}`;

    await grantMediaCredits(
      accountId,
      media.units,
      'monthly_grant',
      periodEnd,
      idempotencyKey,
    );

    await admin.rpc('ensure_media_credit_pool', {
      p_account_id: accountId,
    });

    await admin
      .from('media_credit_pools')
      .update({
        monthly_allowance: media.units,
        plan_tier: media.planTier,
        cycle_start: periodStart.toISOString().slice(0, 10),
        cycle_end: cycleEndIso,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId);

    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'media_generate',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );
    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'apps',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );

    mediaUnits = media.units;
  }

  const campaign = campaignTierForPlanId(plan.planId);
  if (campaign) {
    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, 1);
    const cycleEndIso = periodEnd.toISOString().slice(0, 10);
    const idempotencyKey = `admin_campaigns:${accountId}:${plan.planId}:${cycleEndIso}`;

    await grantCampaignCredits(
      accountId,
      campaign.sendUnits,
      'monthly_grant',
      periodEnd,
      idempotencyKey,
    );

    await updateCampaignCreditPoolMetadata(accountId, {
      monthly_allowance: campaign.sendUnits,
      max_contacts: campaign.maxContacts,
      plan_tier: campaign.planTier,
      cycle_start: periodStart.toISOString().slice(0, 10),
      cycle_end: cycleEndIso,
    });

    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'campaigns',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );
    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'apps',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );

    campaignSendUnits = campaign.sendUnits;
  }

  return { aiCredits, mediaUnits, campaignSendUnits };
}

/**
 * Admin entitlement-only grants (addon_campaigns without a plan apply) used to
 * unlock the UI with zero send units — production sends then 500 with
 * "Not enough send units". Backfill Starter once when the pool is still empty.
 */
export async function ensureAdminCampaignStarterCredits(
  admin: SupabaseClient,
  accountId: string,
): Promise<number | null> {
  const starter = findPlanByProductAndPlanId(
    'ozer-addon-campaigns',
    'campaigns-starter-monthly',
  );
  if (!starter) return null;

  // Tables may be ahead of generated types (same pattern as campaign-credits ledger).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  await db.rpc('ensure_campaign_credit_pool', {
    p_account_id: accountId,
  });

  const { data: pool } = await db
    .from('campaign_credit_pools')
    .select('balance, plan_tier')
    .eq('account_id', accountId)
    .maybeSingle();

  const balance = Number((pool as { balance?: number } | null)?.balance ?? 0);
  const planTier = String(
    (pool as { plan_tier?: string } | null)?.plan_tier ?? 'none',
  );

  if (balance > 0 || (planTier && planTier !== 'none')) {
    // Already provisioned (Stripe or a prior admin plan apply).
    await db.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'campaigns',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );
    return null;
  }

  const usage = await applyAdminPlanUsageGrants(admin, accountId, starter);
  return usage.campaignSendUnits;
}
