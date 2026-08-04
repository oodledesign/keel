import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UpsertOrderParams, UpsertSubscriptionParams } from '@kit/billing/types';
import { getLogger } from '@kit/shared/logger';

import {
  MEDIA_SUBSCRIPTION_TIERS,
  MEDIA_TOPUP_PACKS,
} from '~/lib/billing/media-unit-pricing';
import { OZER_STRIPE_PRICES } from '~/lib/billing/stripe-price-ids';
import { grantMediaCredits } from '~/lib/media-credits/ledger';

const MEDIA_MONTHLY_BY_PRICE: Record<
  string,
  { units: number; planTier: string }
> = {
  [OZER_STRIPE_PRICES.media_starter_monthly]: {
    units: MEDIA_SUBSCRIPTION_TIERS[0].units,
    planTier: 'starter',
  },
  [OZER_STRIPE_PRICES.media_studio_monthly]: {
    units: MEDIA_SUBSCRIPTION_TIERS[1].units,
    planTier: 'studio',
  },
  [OZER_STRIPE_PRICES.media_agency_monthly]: {
    units: MEDIA_SUBSCRIPTION_TIERS[2].units,
    planTier: 'agency',
  },
};

const MEDIA_TOPUP_BY_PRICE: Record<string, number> = {
  [OZER_STRIPE_PRICES.media_topup_small]: MEDIA_TOPUP_PACKS[0].units,
  [OZER_STRIPE_PRICES.media_topup_large]: MEDIA_TOPUP_PACKS[1].units,
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function fulfillMediaTopupOrder(
  admin: SupabaseClient,
  order: UpsertOrderParams,
): Promise<{ granted: boolean; units: number }> {
  const logger = await getLogger();
  const accountId = order.target_account_id;
  const sessionId = order.target_order_id;

  if (!accountId || !sessionId || order.status !== 'succeeded') {
    return { granted: false, units: 0 };
  }

  let totalUnits = 0;
  for (const item of order.line_items ?? []) {
    const units = MEDIA_TOPUP_BY_PRICE[item.variant_id];
    if (!units) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalUnits += units * qty;
  }

  if (totalUnits <= 0) {
    return { granted: false, units: 0 };
  }

  const expiresAt = addMonths(new Date(), 6);
  await grantMediaCredits(
    accountId,
    totalUnits,
    'topup_purchase',
    expiresAt,
    sessionId,
  );

  logger.info(
    { name: 'media.credits.topup', accountId, sessionId, units: totalUnits },
    'Granted media credit top-up',
  );

  return { granted: true, units: totalUnits };
}

/**
 * Monthly media plan invoice: grant a cycle batch that expires at cycle_end.
 * Cancellation: current cycle balance persists until cycle_end (no mid-cycle wipe).
 */
export async function fulfillMediaSubscriptionGrant(
  admin: SupabaseClient,
  subscription: UpsertSubscriptionParams,
): Promise<{ granted: boolean; units: number }> {
  const logger = await getLogger();
  const accountId = subscription.target_account_id;
  const subscriptionId = subscription.target_subscription_id;

  if (!accountId || !subscriptionId) {
    return { granted: false, units: 0 };
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return { granted: false, units: 0 };
  }

  let units = 0;
  let planTier = 'none';
  for (const item of subscription.line_items ?? []) {
    const match = MEDIA_MONTHLY_BY_PRICE[item.variant_id];
    if (!match) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    units += match.units * qty;
    planTier = match.planTier;
  }

  if (units <= 0) {
    return { granted: false, units: 0 };
  }

  const periodStart = subscription.period_starts_at
    ? new Date(subscription.period_starts_at)
    : new Date();
  const periodEnd = subscription.period_ends_at
    ? new Date(subscription.period_ends_at)
    : addMonths(periodStart, 1);

  const cycleEndIso = periodEnd.toISOString().slice(0, 10);
  const idempotencyKey = `media_cycle:${subscriptionId}:${cycleEndIso}`;

  await grantMediaCredits(
    accountId,
    units,
    'monthly_grant',
    periodEnd,
    idempotencyKey,
  );

  await admin
    .from('media_credit_pools')
    .update({
      monthly_allowance: units,
      plan_tier: planTier,
      cycle_start: periodStart.toISOString().slice(0, 10),
      cycle_end: cycleEndIso,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);

  // Subscription implies the app should be usable; enable module if missing.
  await admin.from('account_module_settings').upsert(
    {
      account_id: accountId,
      module_key: 'media_generate',
      enabled: true,
    },
    { onConflict: 'account_id,module_key' },
  );

  logger.info(
    {
      name: 'media.credits.subscription',
      accountId,
      subscriptionId,
      units,
      planTier,
    },
    'Granted monthly media credits',
  );

  return { granted: true, units };
}

export function findMediaTopupUnitsByPriceId(priceId: string): number | null {
  return MEDIA_TOPUP_BY_PRICE[priceId] ?? null;
}

export function findMediaMonthlyByPriceId(priceId: string): {
  units: number;
  planTier: string;
} | null {
  return MEDIA_MONTHLY_BY_PRICE[priceId] ?? null;
}
