import { describe, expect, it } from 'vitest';

import { CAMPAIGN_SUBSCRIPTION_TIERS, campaignTierForPlanId } from './campaign-pricing';

describe('campaign pricing', () => {
  it('prices higher tiers by both contacts and send units', () => {
    const [starter, growth, pro] = CAMPAIGN_SUBSCRIPTION_TIERS;
    expect(starter.maxContacts).toBeLessThan(growth.maxContacts);
    expect(growth.maxContacts).toBeLessThan(pro.maxContacts);
    expect(starter.sendUnits).toBeLessThan(growth.sendUnits);
    expect(growth.sendUnits).toBeLessThan(pro.sendUnits);
    expect(starter.priceGbp).toBeLessThan(growth.priceGbp);
    expect(growth.priceGbp).toBeLessThan(pro.priceGbp);
  });

  it('maps catalog plan ids to tier allowances', () => {
    expect(campaignTierForPlanId('campaigns-starter-monthly')).toEqual({
      sendUnits: 2000,
      maxContacts: 500,
      planTier: 'starter',
    });
    expect(campaignTierForPlanId('campaigns-growth-monthly')?.planTier).toBe(
      'growth',
    );
    expect(campaignTierForPlanId('campaigns-pro-monthly')?.sendUnits).toBe(
      50000,
    );
    expect(campaignTierForPlanId('media-starter-monthly')).toBeNull();
  });
});
