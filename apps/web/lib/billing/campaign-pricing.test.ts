import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_CONTACT_BUMPS,
  CAMPAIGN_SEND_PACKS,
  CAMPAIGN_SUBSCRIPTION_TIERS,
  assertCampaignPacksWorseThanStarter,
  campaignTierForPlanId,
  campaignTierRank,
  findCampaignContactBumpByPriceId,
  findCampaignSendPackByPriceId,
  hasCampaignsGrowthFeatures,
  hasCampaignsProFeatures,
  nextCampaignUpgradeTier,
} from './campaign-pricing';
import { OZER_STRIPE_PRICES } from './stripe-price-ids';

describe('campaign pricing', () => {
  it('uses the public Starter / Growth / Pro ladder', () => {
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

  it('keeps send-pack per-unit worse than Starter', () => {
    expect(assertCampaignPacksWorseThanStarter()).toBe(true);
    expect(CAMPAIGN_SEND_PACKS.map((pack) => pack.sendUnits)).toEqual([
      2000, 10000, 50000,
    ]);
    expect(CAMPAIGN_CONTACT_BUMPS.map((bump) => bump.maxContacts)).toEqual([
      500, 2500,
    ]);
  });

  it('looks up pack and bump price ids', () => {
    expect(
      findCampaignSendPackByPriceId(OZER_STRIPE_PRICES.campaigns_pack_send_2k)
        ?.mode,
    ).toBe('one-time');
    expect(
      findCampaignSendPackByPriceId(
        OZER_STRIPE_PRICES.campaigns_pack_send_10k_monthly,
      )?.mode,
    ).toBe('monthly');
    expect(
      findCampaignContactBumpByPriceId(
        OZER_STRIPE_PRICES.campaigns_bump_contacts_500_monthly,
      )?.maxContacts,
    ).toBe(500);
  });

  it('gates Growth+ and Pro features from plan_tier', () => {
    expect(hasCampaignsGrowthFeatures('starter')).toBe(false);
    expect(hasCampaignsGrowthFeatures('growth')).toBe(true);
    expect(hasCampaignsProFeatures('growth')).toBe(false);
    expect(hasCampaignsProFeatures('pro')).toBe(true);
    expect(campaignTierRank('none')).toBe(0);
    expect(nextCampaignUpgradeTier('starter')?.id).toBe('growth');
    expect(nextCampaignUpgradeTier('pro')).toBeNull();
  });
});
