import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type Stripe from 'stripe';

import { getLogger } from '@kit/shared/logger';

import { REWARDS_CONFIG } from '~/config/rewards.config';
import type { Database } from '~/lib/database.types';

import { applyStripeCustomerBalanceCredit } from './apply-stripe-customer-balance-credit';
import {
  computeMonthlyEquivalentPence,
  computeReferrerRewardPence,
  computeReferredDiscountPence,
} from './compute-monthly-equivalent-gbp';
import { getRewardsStripeClient } from './stripe-client';

type AdminClient = SupabaseClient<Database>;

async function resolveReferredUserIdForAccount(
  admin: AdminClient,
  accountId: string,
): Promise<string | null> {
  const { data: account } = await admin
    .from('accounts')
    .select('id, is_personal_account, primary_owner_user_id')
    .eq('id', accountId)
    .maybeSingle();

  if (!account) return null;

  if (account.is_personal_account) {
    return account.id;
  }

  return account.primary_owner_user_id;
}

async function resolveReferrerMonthlyPlan(params: {
  admin: AdminClient;
  referrerUserId: string;
  stripe: Stripe;
}): Promise<{ planId: string; amountPence: number; stripePriceId?: string }> {
  const { targetAccountId } = await import('./resolve-reward-stripe-customer').then(
    (m) => m.loadRewardCreditTarget(params.admin, params.referrerUserId),
  );

  const { data: subscription } = await params.admin
    .from('subscriptions')
    .select('id, status')
    .eq('account_id', targetAccountId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription?.id) {
    return {
      planId: 'community-monthly',
      amountPence: Math.round(REWARDS_CONFIG.referrerFallbackMonthlyGbp * 100),
    };
  }

  const { data: lineItem } = await params.admin
    .from('subscription_items')
    .select('variant_id, quantity')
    .eq('subscription_id', subscription.id)
    .limit(1)
    .maybeSingle();

  if (!lineItem?.variant_id) {
    return {
      planId: 'community-monthly',
      amountPence: Math.round(REWARDS_CONFIG.referrerFallbackMonthlyGbp * 100),
    };
  }

  const computed = computeMonthlyEquivalentPence({
    stripePriceId: lineItem.variant_id,
    quantity: lineItem.quantity ?? 1,
  });

  return {
    ...computed,
    stripePriceId: lineItem.variant_id,
  };
}

function invoiceHadReferralDiscount(invoice: Stripe.Invoice): boolean {
  const discounts = invoice.total_discount_amounts ?? [];
  return discounts.some((d) => (d.amount ?? 0) > 0);
}

export async function convertReferralOnInvoicePaid(
  admin: AdminClient,
  event: Stripe.InvoicePaidEvent,
): Promise<void> {
  const logger = await getLogger();
  const stripe = getRewardsStripeClient();
  const invoice = event.data.object;

  if (!invoice.id) {
    return;
  }

  if ((invoice.amount_paid ?? 0) <= 0) {
    return;
  }

  const customerId = invoice.customer as string | null;
  if (!customerId) {
    return;
  }

  let subscriptionId: string | undefined;
  if ('subscription' in invoice && invoice.subscription) {
    subscriptionId = invoice.subscription as string;
  } else {
    subscriptionId = invoice.parent?.subscription_details?.subscription as
      | string
      | undefined;
  }

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const accountId = subscription.metadata?.accountId;

  if (!accountId) {
    logger.warn(
      { subscriptionId, invoiceId: invoice.id },
      '[rewards] invoice.paid missing accountId metadata',
    );
    return;
  }

  const referredUserId = await resolveReferredUserIdForAccount(
    admin,
    accountId,
  );

  if (!referredUserId) {
    return;
  }

  const { data: referral, error: referralError } = await admin
    .from('referrals')
    .select('*')
    .eq('referred_user_id', referredUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (referralError || !referral) {
    return;
  }

  const lineItem = subscription.items.data[0];
  const stripePriceId = lineItem?.price.id;
  const quantity = lineItem?.quantity ?? 1;

  const referredMonthly = stripePriceId
    ? computeMonthlyEquivalentPence({ stripePriceId, quantity })
    : {
        planId: 'unknown',
        amountPence: Math.round(
          REWARDS_CONFIG.referrerFallbackMonthlyGbp * 100,
        ),
      };

  const referredDiscountPence =
    referral.referred_discount_pence ??
    computeReferredDiscountPence(referredMonthly.amountPence);

  const referrerPlan = await resolveReferrerMonthlyPlan({
    admin,
    referrerUserId: referral.referrer_user_id,
    stripe,
  });

  const referrerCreditPence = computeReferrerRewardPence(
    referrerPlan.amountPence,
  );

  const { data: lockedReferral, error: lockError } = await admin
    .from('referrals')
    .update({
      status: 'converted',
      converting_account_id: accountId,
      converting_stripe_invoice_id: invoice.id,
      referrer_plan_key: referrerPlan.planId,
      referrer_credit_pence: referrerCreditPence,
      referred_discount_pence: referredDiscountPence,
      converted_at: new Date().toISOString(),
    })
    .eq('id', referral.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (lockError) {
    logger.error(
      { error: lockError, referralId: referral.id },
      '[rewards] failed to lock referral for conversion',
    );
    throw new Error(lockError.message);
  }

  if (!lockedReferral) {
    return;
  }

  await applyStripeCustomerBalanceCredit({
    admin,
    userId: referral.referrer_user_id,
    amountPence: referrerCreditPence,
    source: 'referral',
    description: 'Referral reward — friend subscribed to Ozer',
    sourceReferralId: referral.id,
    metadata: { kind: 'referrer' },
    stripe,
  });

  if (!invoiceHadReferralDiscount(invoice) && referredDiscountPence > 0) {
    await applyStripeCustomerBalanceCredit({
      admin,
      userId: referredUserId,
      amountPence: referredDiscountPence,
      source: 'referral',
      description: 'Referral welcome credit',
      sourceReferralId: referral.id,
      metadata: { kind: 'referred_fallback' },
      stripe,
    });
  }

  if (referral.referral_click_id) {
    await admin
      .from('referral_clicks')
      .update({ converted_referred_user_id: referredUserId })
      .eq('id', referral.referral_click_id);
  }
}
