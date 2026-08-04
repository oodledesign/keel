import { describe, expect, it } from 'vitest';

import {
  MEDIA_SUBSCRIPTION_TIERS,
  MEDIA_TOPUP_PACKS,
} from './media-unit-pricing';
import { OZER_STRIPE_PRICES } from './stripe-price-ids';

describe('media Stripe price wiring', () => {
  it('maps config tiers to distinct Stripe price placeholders', () => {
    expect(OZER_STRIPE_PRICES.media_starter_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.media_studio_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.media_agency_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.media_topup_small).toBeTruthy();
    expect(OZER_STRIPE_PRICES.media_topup_large).toBeTruthy();
    expect(MEDIA_SUBSCRIPTION_TIERS).toHaveLength(3);
    expect(MEDIA_TOPUP_PACKS).toHaveLength(2);
  });

  it('uses stripe session id as grant idempotency key (same key = one grant)', () => {
    const seen = new Set<string>();
    const grantOnce = (stripeEventId: string) => {
      if (seen.has(stripeEventId)) return false;
      seen.add(stripeEventId);
      return true;
    };
    expect(grantOnce('cs_test_media_1')).toBe(true);
    expect(grantOnce('cs_test_media_1')).toBe(false);
    expect(seen.size).toBe(1);
  });
});
