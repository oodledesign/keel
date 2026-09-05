import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  UpsertOrderParams,
  UpsertSubscriptionParams,
} from '@kit/billing/types';
import { getLogger } from '@kit/shared/logger';

import {
  CAMPAIGN_CONTACT_BUMP_PACKS,
  CAMPAIGN_SEND_TOPUP_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
} from '~/lib/billing/campaign-pricing';
import { OZER_STRIPE_PRICES } from '~/lib/billing/stripe-price-ids';
import {
  applyCampaignContactBump,
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

const CAMPAIGN_SEND_TOPUP_BY_PRICE: Record<string, number> = {
  [OZER_STRIPE_PRICES.campaigns_topup_sends_2k]:
    CAMPAIGN_SEND_TOPUP_PACKS[0].sendUnits,
  [OZER_STRIPE_PRICES.campaigns_topup_sends_10k]:
    CAMPAIGN_SEND_TOPUP_PACKS[1].sendUnits,
  [OZER_STRIPE_PRICES.campaigns_topup_sends_50k]:
    CAMPAIGN_SEND_TOPUP_PACKS[2].sendUnits,
};

const CAMPAIGN_CONTACT_BUMP_BY_PRICE: Record<string, number> = {
  [OZER_STRIPE_PRICES.campaigns_topup_contacts_500]:
    CAMPAIGN_CONTACT_BUMP_PACKS[0].contacts,
  [OZER_STRIPE_PRICES.campaigns_topup_contacts_2500]:
    CAMPAIGN_CONTACT_BUMP_PACKS[1].contacts,
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

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

  let sendUnits = 0;
  let maxContacts = 0;
  let planTier = 'none';

  for (const item of subscription.line_items ?? []) {
    const match = CAMPAIGN_MONTHLY_BY_PRICE[item.variant_id];
    if (!match) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    sendUnits += match.sendUnits * qty;
    maxContacts = Math.max(maxContacts, match.maxContacts * qty);
    planTier = match.planTier;
  }

  if (sendUnits <= 0) {
    return { granted: false, sendUnits: 0 };
  }

  const periodStart = subscription.period_starts_at
    ? new Date(subscription.period_starts_at)
    : new Date();
  const periodEnd = subscription.period_ends_at
    ? new Date(subscription.period_ends_at)
    : addMonths(periodStart, 1);

  const cycleEndIso = periodEnd.toISOString().slice(0, 10);
  const idempotencyKey = `campaign_cycle:${subscriptionId}:${cycleEndIso}`;

  await grantCampaignCredits(
    accountId,
    sendUnits,
    'monthly_grant',
    periodEnd,
    idempotencyKey,
  );

  // Replenish the monthly allotment; do not wipe bonus_contacts from packs.
  await updateCampaignCreditPoolMetadata(accountId, {
    monthly_allowance: sendUnits,
    max_contacts: maxContacts,
    plan_tier: planTier,
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
      sendUnits,
      maxContacts,
      planTier,
    },
    'Granted monthly campaign send units',
  );

  return { granted: true, sendUnits };
}

export async function fulfillCampaignPackOrder(
  _admin: SupabaseClient,
  order: UpsertOrderParams,
): Promise<{ granted: boolean; sendUnits: number; contacts: number }> {
  const logger = await getLogger();
  const accountId = order.target_account_id;
  const sessionId = order.target_order_id;

  if (!accountId || !sessionId || order.status !== 'succeeded') {
    return { granted: false, sendUnits: 0, contacts: 0 };
  }

  let sendUnits = 0;
  let contacts = 0;

  for (const item of order.line_items ?? []) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const sends = CAMPAIGN_SEND_TOPUP_BY_PRICE[item.variant_id];
    if (sends) sendUnits += sends * qty;
    const bump = CAMPAIGN_CONTACT_BUMP_BY_PRICE[item.variant_id];
    if (bump) contacts += bump * qty;
  }

  if (sendUnits <= 0 && contacts <= 0) {
    return { granted: false, sendUnits: 0, contacts: 0 };
  }

  if (sendUnits > 0) {
    await grantCampaignCredits(
      accountId,
      sendUnits,
      'topup_purchase',
      addMonths(new Date(), 6),
      `campaign_topup:${sessionId}`,
    );
  }

  if (contacts > 0) {
    await applyCampaignContactBump(
      accountId,
      contacts,
      `campaign_contacts:${sessionId}`,
    );
  }

  logger.info(
    {
      name: 'campaigns.credits.pack',
      accountId,
      sessionId,
      sendUnits,
      contacts,
    },
    'Granted campaign pack',
  );

  return { granted: true, sendUnits, contacts };
}

export function findCampaignMonthlyByPriceId(priceId: string): {
  sendUnits: number;
  maxContacts: number;
  planTier: string;
} | null {
  return CAMPAIGN_MONTHLY_BY_PRICE[priceId] ?? null;
}
