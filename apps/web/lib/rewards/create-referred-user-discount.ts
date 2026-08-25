import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type Stripe from 'stripe';

import { REWARDS_CONFIG } from '~/config/rewards.config';
import type { Database } from '~/lib/database.types';

import {
  computeMonthlyEquivalentPence,
  computeReferredDiscountPence,
} from './compute-monthly-equivalent-gbp';
import { getRewardsStripeClient } from './stripe-client';

type AdminClient = SupabaseClient<Database>;

export async function createReferredUserDiscountCoupon(params: {
  admin: AdminClient;
  referralId: string;
  stripePriceId: string;
  quantity?: number;
  stripe?: Stripe;
}): Promise<{ couponId: string; discountPence: number }> {
  const stripe = params.stripe ?? getRewardsStripeClient();
  const { amountPence } = computeMonthlyEquivalentPence({
    stripePriceId: params.stripePriceId,
    quantity: params.quantity,
  });
  const discountPence = computeReferredDiscountPence(amountPence);

  const coupon = await stripe.coupons.create({
    amount_off: discountPence,
    currency: 'gbp',
    duration: 'once',
    name: `Referral welcome (${params.referralId.slice(0, 8)})`,
    metadata: {
      referralId: params.referralId,
      source: 'referral_welcome',
    },
  });

  await params.admin
    .from('referrals')
    .update({
      referred_discount_pence: discountPence,
      referred_stripe_coupon_id: coupon.id,
    })
    .eq('id', params.referralId);

  return { couponId: coupon.id, discountPence };
}

export async function getPendingReferralForUser(
  admin: AdminClient,
  referredUserId: string,
) {
  const { data: referral } = await admin
    .from('referrals')
    .select(
      'id, referrer_user_id, referred_discount_pence, referred_stripe_coupon_id',
    )
    .eq('referred_user_id', referredUserId)
    .eq('status', 'pending')
    .maybeSingle();

  return referral;
}

export async function resolveReferralCheckoutCoupon(params: {
  admin: AdminClient;
  referredUserId: string;
  stripePriceId: string;
  quantity?: number;
}): Promise<string | undefined> {
  const referral = await getPendingReferralForUser(
    params.admin,
    params.referredUserId,
  );

  if (!referral) {
    return undefined;
  }

  if (referral.referred_stripe_coupon_id) {
    return referral.referred_stripe_coupon_id;
  }

  const { couponId } = await createReferredUserDiscountCoupon({
    admin: params.admin,
    referralId: referral.id,
    stripePriceId: params.stripePriceId,
    quantity: params.quantity,
  });

  return couponId;
}

export { REWARDS_CONFIG };
