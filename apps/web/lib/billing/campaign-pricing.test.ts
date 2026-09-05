import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_CONTACT_BUMP_PACKS,
  CAMPAIGN_SEND_TOPUP_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
  campaignFeaturesForTier,
  campaignTierForPlanId,
  campaignUsageMeter,
  effectiveCampaignContactCap,
  nextCampaignUpgradeTier,
} from './campaign-pricing';

describe('campaign pricing', () => {
  it('prices Starter / Growth / Pro at £9 / £19 / £49 with rising caps', () => {
    const [starter, growth, pro] = CAMPAIGN_SUBSCRIPTION_TIERS;
    expect(starter).toMatchObject({
      priceGbp: 9,
      maxContacts: 500,
      sendUnits: 5000,
    });
    expect(growth).toMatchObject({
      priceGbp: 19,
      maxContacts: 2500,
      sendUnits: 20000,
    });
    expect(pro).toMatchObject({
      priceGbp: 49,
      maxContacts: 10000,
      sendUnits: 60000,
    });
    expect(starter.maxContacts).toBeLessThan(growth.maxContacts);
    expect(growth.maxContacts).toBeLessThan(pro.maxContacts);
    expect(starter.sendUnits).toBeLessThan(growth.sendUnits);
    expect(growth.sendUnits).toBeLessThan(pro.sendUnits);
    expect(starter.priceGbp).toBeLessThan(growth.priceGbp);
    expect(growth.priceGbp).toBeLessThan(pro.priceGbp);
  });

  it('maps catalog plan ids to tier allowances', () => {
    expect(campaignTierForPlanId('campaigns-starter-monthly')).toEqual({
      sendUnits: 5000,
      maxContacts: 500,
      planTier: 'starter',
    });
    expect(campaignTierForPlanId('campaigns-growth-monthly')?.planTier).toBe(
      'growth',
    );
    expect(campaignTierForPlanId('campaigns-pro-monthly')?.sendUnits).toBe(
      60000,
    );
    expect(campaignTierForPlanId('media-starter-monthly')).toBeNull();
  });

  it('gates A/B and rich analytics to Growth+', () => {
    expect(campaignFeaturesForTier('starter').abSubjects).toBe(false);
    expect(campaignFeaturesForTier('starter').richAnalytics).toBe(false);
    expect(campaignFeaturesForTier('starter').savedLists).toBe(false);
    expect(campaignFeaturesForTier('growth').abSubjects).toBe(true);
    expect(campaignFeaturesForTier('growth').richAnalytics).toBe(true);
    expect(campaignFeaturesForTier('pro').abSubjects).toBe(true);
    expect(campaignFeaturesForTier('none')).toEqual({
      coreCampaigns: false,
      audiences: false,
      sendTest: false,
      basicAnalytics: false,
      customFrom: false,
      savedLists: false,
      abSubjects: false,
      richAnalytics: false,
    });
  });

  it('offers an upgrade path Starter → Growth → Pro', () => {
    expect(nextCampaignUpgradeTier('none')?.id).toBe('starter');
    expect(nextCampaignUpgradeTier('starter')?.id).toBe('growth');
    expect(nextCampaignUpgradeTier('growth')?.id).toBe('pro');
    expect(nextCampaignUpgradeTier('pro')).toBeNull();
  });

  it('defines send top-ups and contact bumps', () => {
    expect(CAMPAIGN_SEND_TOPUP_PACKS.map((pack) => pack.sendUnits)).toEqual([
      2000, 10000, 50000,
    ]);
    expect(CAMPAIGN_CONTACT_BUMP_PACKS.map((pack) => pack.contacts)).toEqual([
      500, 2500,
    ]);
  });

  it('adds bonus contacts on top of the plan cap', () => {
    expect(
      effectiveCampaignContactCap({ maxContacts: 500, bonusContacts: 500 }),
    ).toBe(1000);
    expect(
      effectiveCampaignContactCap({ maxContacts: 0, bonusContacts: 2500 }),
    ).toBe(0);
  });

  it('warns at 80% and hard-blocks at the cap', () => {
    const warn = campaignUsageMeter({ used: 400, cap: 500 });
    expect(warn.softWarning).toBe(true);
    expect(warn.hardBlocked).toBe(false);

    const blocked = campaignUsageMeter({ used: 500, cap: 500 });
    expect(blocked.hardBlocked).toBe(true);
    expect(blocked.remaining).toBe(0);

    const unlimited = campaignUsageMeter({ used: 9999, cap: 0 });
    expect(unlimited.unlimited).toBe(true);
    expect(unlimited.hardBlocked).toBe(false);
  });
});
