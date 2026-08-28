import 'server-only';

import { cache } from 'react';

import Stripe from 'stripe';

import type { PlatformSubscriptionDiscount } from '~/lib/billing/platform-subscription-discount-types';
import { getStripeClientSecret } from '~/lib/billing/stripe-connect';

export type { PlatformSubscriptionDiscount };

function mapCoupon(
  coupon: Stripe.Coupon | string | null | undefined,
  discountEnd: number | null,
): PlatformSubscriptionDiscount | null {
  if (!coupon || typeof coupon === 'string') {
    return null;
  }

  return {
    name: coupon.name?.trim() || coupon.id || null,
    percentOff: coupon.percent_off ?? null,
    amountOffMinor: coupon.amount_off ?? null,
    currency: coupon.currency?.toLowerCase() ?? null,
    duration: coupon.duration ?? null,
    durationInMonths: coupon.duration_in_months ?? null,
    endsAt: discountEnd
      ? new Date(discountEnd * 1000).toISOString()
      : null,
  };
}

/**
 * Active discount on a platform Stripe subscription (promo / referral coupon).
 */
export const loadPlatformSubscriptionDiscount = cache(
  async (
    stripeSubscriptionId: string | null | undefined,
  ): Promise<PlatformSubscriptionDiscount | null> => {
    const subscriptionId = stripeSubscriptionId?.trim();
    if (!subscriptionId) {
      return null;
    }

    try {
      const stripe = new Stripe(getStripeClientSecret());
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['discounts.source.coupon'],
      });

      for (const entry of subscription.discounts ?? []) {
        if (typeof entry === 'string' || entry.deleted) {
          continue;
        }

        const mapped = mapCoupon(entry.source?.coupon, entry.end);
        if (mapped) {
          return mapped;
        }
      }

      return null;
    } catch (error) {
      console.error(
        '[platform-billing] stripe subscription discount failed',
        error,
      );
      return null;
    }
  },
);
