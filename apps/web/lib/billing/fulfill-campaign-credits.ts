import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UpsertSubscriptionParams } from '@kit/billing/types';
import { getLogger } from '@kit/shared/logger';

import { CAMPAIGN_SUBSCRIPTION_TIERS } from '~/lib/billing/campaign-pricing';
import { OZER_STRIPE_PRICES } from '~/lib/billing/stripe-price-ids';
import { grantCampaignCredits } from '~/lib/campaign-credits/ledger';

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

  await admin
    .from('campaign_credit_pools')
    .update({
      monthly_allowance: sendUnits,
      max_contacts: maxContacts,
      plan_tier: planTier,
      cycle_start: periodStart.toISOString().slice(0, 10),
      cycle_end: cycleEndIso,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);

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

export function findCampaignMonthlyByPriceId(priceId: string): {
  sendUnits: number;
  maxContacts: number;
  planTier: string;
} | null {
  return CAMPAIGN_MONTHLY_BY_PRICE[priceId] ?? null;
}
