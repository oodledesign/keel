import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  hasCampaignsAutomations,
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

  it('keeps welcome automations on every paid Campaigns plan', () => {
    expect(hasCampaignsAutomations('starter')).toBe(true);
    expect(hasCampaignsAutomations('growth')).toBe(true);
    expect(hasCampaignsAutomations('pro')).toBe(true);
    expect(hasCampaignsAutomations('none')).toBe(false);
  });

  it('is listed in stripe-setup-catalog with settled GBP amounts', () => {
    const catalog = readFileSync(
      path.resolve(__dirname, '../../scripts/stripe-setup-catalog.mjs'),
      'utf8',
    );

    const required = [
      [
        'ozer-addon-campaigns',
        'STRIPE_PRICE_ADDON_CAMPAIGNS_STARTER_MONTHLY',
        900,
      ],
      [
        'ozer-addon-campaigns',
        'STRIPE_PRICE_ADDON_CAMPAIGNS_GROWTH_MONTHLY',
        1900,
      ],
      [
        'ozer-addon-campaigns',
        'STRIPE_PRICE_ADDON_CAMPAIGNS_PRO_MONTHLY',
        4900,
      ],
      [
        'ozer-campaigns-pack-send-2k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_2K',
        600,
      ],
      [
        'ozer-campaigns-pack-send-2k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_2K_MONTHLY',
        500,
      ],
      [
        'ozer-campaigns-pack-send-10k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_10K',
        2400,
      ],
      [
        'ozer-campaigns-pack-send-10k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_10K_MONTHLY',
        2000,
      ],
      [
        'ozer-campaigns-pack-send-50k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_50K',
        9900,
      ],
      [
        'ozer-campaigns-pack-send-50k',
        'STRIPE_PRICE_CAMPAIGNS_PACK_SEND_50K_MONTHLY',
        9900,
      ],
      [
        'ozer-campaigns-bump-contacts-500',
        'STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_500_MONTHLY',
        800,
      ],
      [
        'ozer-campaigns-bump-contacts-2500',
        'STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_2500_MONTHLY',
        2900,
      ],
    ] as const;

    for (const [catalogId, envKey, amount] of required) {
      const marker = `catalogId: '${catalogId}'`;
      const start = catalog.indexOf(marker);
      expect(start).toBeGreaterThan(-1);

      const next = catalog.indexOf("catalogId: '", start + marker.length);
      const block = catalog.slice(start, next === -1 ? undefined : next);
      expect(block).toContain(`envKey: '${envKey}'`);
      expect(block).toContain(`amount: ${amount}`);
    }

    expect(OZER_STRIPE_PRICES.addon_campaigns_starter_monthly).toBeTruthy();
  });
});
