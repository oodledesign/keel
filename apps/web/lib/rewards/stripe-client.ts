import 'server-only';

import Stripe from 'stripe';

import { getStripeClientSecret } from '~/lib/billing/stripe-connect';

let stripeSingleton: Stripe | null = null;

export function getRewardsStripeClient(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeClientSecret());
  }

  return stripeSingleton;
}
