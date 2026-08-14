import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { syncAccountCreditLimit } from '~/lib/ai/tiers';
import { MEDIA_SUBSCRIPTION_TIERS } from '~/lib/billing/media-unit-pricing';
import type { OzerPlanDefinition } from '~/lib/billing/ozer-plan-catalog';
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
}> {
  let aiCredits: number | null = null;
  let mediaUnits: number | null = null;

  const isAiPlan =
    plan.family === 'business' ||
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

  return { aiCredits, mediaUnits };
}
