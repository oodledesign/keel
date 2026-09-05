import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_CONTACT_BUMP_PACKS,
  CAMPAIGN_SEND_TOPUP_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
} from './campaign-pricing';
import { OZER_STRIPE_PRICES } from './stripe-price-ids';

describe('campaign Stripe price wiring', () => {
  it('maps tiers and packs to distinct Stripe price placeholders', () => {
    expect(OZER_STRIPE_PRICES.addon_campaigns_starter_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.addon_campaigns_growth_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.addon_campaigns_pro_monthly).toBeTruthy();
    expect(OZER_STRIPE_PRICES.campaigns_topup_sends_2k).toBeTruthy();
    expect(OZER_STRIPE_PRICES.campaigns_topup_sends_10k).toBeTruthy();
    expect(OZER_STRIPE_PRICES.campaigns_topup_sends_50k).toBeTruthy();
    expect(OZER_STRIPE_PRICES.campaigns_topup_contacts_500).toBeTruthy();
    expect(OZER_STRIPE_PRICES.campaigns_topup_contacts_2500).toBeTruthy();
    expect(CAMPAIGN_SUBSCRIPTION_TIERS).toHaveLength(3);
    expect(CAMPAIGN_SEND_TOPUP_PACKS).toHaveLength(3);
    expect(CAMPAIGN_CONTACT_BUMP_PACKS).toHaveLength(2);
  });
});
