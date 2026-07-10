import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UpsertOrderParams } from '@kit/billing/types';
import { getLogger } from '@kit/shared/logger';

import { findAiCreditPackByPriceId } from '~/lib/billing/ai-credit-packs';
import { syncAccountCreditLimit } from '~/lib/ai/tiers';

/**
 * After a one-time Checkout completes, map Stripe price → credit pack and
 * grant purchased credits on the billed account (idempotent by session id).
 */
export async function fulfillAiCreditPackOrder(
  admin: SupabaseClient,
  order: UpsertOrderParams,
): Promise<{ granted: boolean; credits: number }> {
  const logger = await getLogger();
  const accountId = order.target_account_id;
  const sessionId = order.target_order_id;

  if (!accountId || !sessionId) {
    return { granted: false, credits: 0 };
  }

  if (order.status !== 'succeeded') {
    logger.info(
      { name: 'ai.credits.purchase', accountId, sessionId, status: order.status },
      'Skipping AI credit grant — order not succeeded',
    );
    return { granted: false, credits: 0 };
  }

  const lineItems = order.line_items ?? [];
  let totalCredits = 0;
  let primaryPriceId: string | null = null;

  for (const item of lineItems) {
    const pack = findAiCreditPackByPriceId(item.variant_id);
    if (!pack || pack.paymentType === 'monthly') continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalCredits += pack.credits * qty;
    primaryPriceId ??= pack.stripePriceId;
  }

  if (totalCredits <= 0 || !primaryPriceId) {
    return { granted: false, credits: 0 };
  }

  const { data, error } = await admin.rpc('grant_ai_credit_purchase', {
    p_account_id: accountId,
    p_stripe_checkout_session_id: sessionId,
    p_stripe_price_id: primaryPriceId,
    p_credits: totalCredits,
    p_amount_total: order.total_amount ?? null,
    p_currency: order.currency ?? null,
  });

  if (error) {
    logger.error(
      { name: 'ai.credits.purchase', accountId, sessionId, error: error.message },
      'Failed to grant AI credit purchase',
    );
    throw new Error(error.message);
  }

  // Ensure plan monthly limit is correct if this created the balance row.
  await syncAccountCreditLimit(accountId, admin).catch(() => undefined);

  logger.info(
    {
      name: 'ai.credits.purchase',
      accountId,
      sessionId,
      credits: totalCredits,
      balance: data,
    },
    'Granted AI credit pack purchase',
  );

  return { granted: true, credits: totalCredits };
}

/**
 * Grant credits when a monthly AI credit boost subscription invoice is paid.
 * Idempotent per subscription billing period.
 */
export async function fulfillAiCreditPackFromSubscription(
  admin: SupabaseClient,
  subscription: UpsertSubscriptionParams,
): Promise<{ granted: boolean; credits: number }> {
  const logger = await getLogger();
  const accountId = subscription.target_account_id;
  const subscriptionId = subscription.target_subscription_id;

  if (!accountId || !subscriptionId) {
    return { granted: false, credits: 0 };
  }

  if (
    subscription.status !== 'active' &&
    subscription.status !== 'trialing'
  ) {
    return { granted: false, credits: 0 };
  }

  const lineItems = subscription.line_items ?? [];
  let totalCredits = 0;
  let primaryPriceId: string | null = null;

  for (const item of lineItems) {
    const pack = findAiCreditPackByPriceId(item.variant_id);
    if (!pack || pack.paymentType !== 'monthly') continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalCredits += pack.credits * qty;
    primaryPriceId ??= pack.stripePriceId;
  }

  if (totalCredits <= 0 || !primaryPriceId) {
    return { granted: false, credits: 0 };
  }

  const periodKey = subscription.period_starts_at ?? 'unknown';
  const idempotencyKey = `sub_credit:${subscriptionId}:${periodKey}`;

  const { data, error } = await admin.rpc('grant_ai_credit_purchase', {
    p_account_id: accountId,
    p_stripe_checkout_session_id: idempotencyKey,
    p_stripe_price_id: primaryPriceId,
    p_credits: totalCredits,
    p_amount_total: null,
    p_currency: subscription.currency ?? null,
  });

  if (error) {
    logger.error(
      {
        name: 'ai.credits.subscription',
        accountId,
        subscriptionId,
        error: error.message,
      },
      'Failed to grant monthly AI credit boost',
    );
    throw new Error(error.message);
  }

  await syncAccountCreditLimit(accountId, admin).catch(() => undefined);

  logger.info(
    {
      name: 'ai.credits.subscription',
      accountId,
      subscriptionId,
      credits: totalCredits,
      balance: data,
    },
    'Granted monthly AI credit boost',
  );

  return { granted: true, credits: totalCredits };
}
