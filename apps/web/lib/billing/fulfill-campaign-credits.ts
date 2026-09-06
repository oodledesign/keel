import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  UpsertOrderParams,
  UpsertSubscriptionParams,
} from '@kit/billing/types';
import { getLogger } from '@kit/shared/logger';

import {
  CAMPAIGN_SUBSCRIPTION_TIERS,
  findCampaignContactBumpByPriceId,
  findCampaignSendPackByPriceId,
} from '~/lib/billing/campaign-pricing';
import { OZER_STRIPE_PRICES } from '~/lib/billing/stripe-price-ids';
import {
  grantCampaignCredits,
  updateCampaignCreditPoolMetadata,
} from '~/lib/campaign-credits/ledger';

const CAMPAIGN_MONTHLY_BY_PRICE: Record<
  string,
  { sendUnits: number; maxContacts: number; planTier: string }
> = {
  [OZER_STRIPE_PRICES.addon_campaigns_starter_monthly]: {
    sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[0].sendUnits,
    maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[0].maxContacts,
    planTier: 'starter',
  },
  [OZER_STRIPE_PRICES.addon_campaigns_growth_monthly]: {
    sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[1].sendUnits,
    maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[1].maxContacts,
    planTier: 'growth',
  },
  [OZER_STRIPE_PRICES.addon_campaigns_pro_monthly]: {
    sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[2].sendUnits,
    maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[2].maxContacts,
    planTier: 'pro',
  },
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * Monthly plan + recurring send packs + contact bumps.
 * Each invoice.paid grants a new cycle batch (idempotent by subscription + cycle).
 */
/**
 * `admin` is used for module-settings upserts. Credit grants go through
 * `grantCampaignCredits`, which uses the server admin client internally.
 */
export async function fulfillCampaignSubscriptionGrant(
  admin: SupabaseClient,
  subscription: UpsertSubscriptionParams,
): Promise<{ granted: boolean; sendUnits: number }> {
  const logger = await getLogger();
  const accountId = subscription.target_account_id;
  const subscriptionId = subscription.target_subscription_id;

  if (!accountId || !subscriptionId) {
    return { granted: false, sendUnits: 0 };
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return { granted: false, sendUnits: 0 };
  }

  let planSendUnits = 0;
  let packSendUnits = 0;
  let maxContacts = 0;
  let contactBonus = 0;
  let planTier = 'none';

  for (const item of subscription.line_items ?? []) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const plan = CAMPAIGN_MONTHLY_BY_PRICE[item.variant_id];
    if (plan) {
      planSendUnits += plan.sendUnits * qty;
      maxContacts = Math.max(maxContacts, plan.maxContacts * qty);
      planTier = plan.planTier;
      continue;
    }

    const pack = findCampaignSendPackByPriceId(item.variant_id);
    if (pack?.mode === 'monthly') {
      packSendUnits += pack.sendUnits * qty;
      continue;
    }

    const bump = findCampaignContactBumpByPriceId(item.variant_id);
    if (bump) {
      contactBonus += bump.maxContacts * qty;
    }
  }

  const sendUnits = planSendUnits + packSendUnits;
  if (sendUnits <= 0 && contactBonus <= 0 && maxContacts <= 0) {
    return { granted: false, sendUnits: 0 };
  }

  const periodStart = subscription.period_starts_at
    ? new Date(subscription.period_starts_at)
    : new Date();
  const periodEnd = subscription.period_ends_at
    ? new Date(subscription.period_ends_at)
    : addMonths(periodStart, 1);

  const cycleEndIso = periodEnd.toISOString().slice(0, 10);

  if (planSendUnits > 0) {
    await grantCampaignCredits(
      accountId,
      planSendUnits,
      'monthly_grant',
      periodEnd,
      `campaign_cycle:${subscriptionId}:${cycleEndIso}`,
    );
  }

  if (packSendUnits > 0) {
    await grantCampaignCredits(
      accountId,
      packSendUnits,
      'pack_recurring',
      periodEnd,
      `campaign_pack:${subscriptionId}:${cycleEndIso}`,
    );
  }

  await updateCampaignCreditPoolMetadata(accountId, {
    monthly_allowance: planSendUnits,
    max_contacts: maxContacts + contactBonus,
    contact_bonus: contactBonus,
    plan_tier: planTier === 'none' && contactBonus > 0 ? 'starter' : planTier,
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

  logger.info(
    {
      name: 'campaigns.credits.subscription',
      accountId,
      subscriptionId,
      planSendUnits,
      packSendUnits,
      maxContacts,
      contactBonus,
      planTier,
    },
    'Granted monthly campaign send units',
  );

  return { granted: sendUnits > 0, sendUnits };
}

/** One-off send packs from Checkout / payment_succeeded. */
export async function fulfillCampaignTopupOrder(
  admin: SupabaseClient,
  order: UpsertOrderParams,
): Promise<{ granted: boolean; sendUnits: number }> {
  const logger = await getLogger();
  const accountId = order.target_account_id;
  const sessionId = order.target_order_id;

  if (!accountId || !sessionId || order.status !== 'succeeded') {
    return { granted: false, sendUnits: 0 };
  }

  let totalUnits = 0;
  for (const item of order.line_items ?? []) {
    const pack = findCampaignSendPackByPriceId(item.variant_id);
    if (!pack || pack.mode !== 'one-time') continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalUnits += pack.sendUnits * qty;
  }

  if (totalUnits <= 0) {
    return { granted: false, sendUnits: 0 };
  }

  const expiresAt = addMonths(new Date(), 12);
  await grantCampaignCredits(
    accountId,
    totalUnits,
    'topup_purchase',
    expiresAt,
    `campaign_topup:${sessionId}`,
  );

  await admin.from('account_module_settings').upsert(
    {
      account_id: accountId,
      module_key: 'campaigns',
      enabled: true,
    },
    { onConflict: 'account_id,module_key' },
  );

  logger.info(
    {
      name: 'campaigns.credits.topup',
      accountId,
      sessionId,
      sendUnits: totalUnits,
    },
    'Granted campaign send-pack top-up',
  );

  return { granted: true, sendUnits: totalUnits };
}

export function findCampaignMonthlyByPriceId(priceId: string): {
  sendUnits: number;
  maxContacts: number;
  planTier: string;
} | null {
  return CAMPAIGN_MONTHLY_BY_PRICE[priceId] ?? null;
}
