/**
 * Campaigns add-on pricing (GBP). Distinct from Signatures, Media Generate,
 * and commercial Circulation — never merge those pools.
 *
 * Monthly send allotment: each paid invoice grants a `monthly_grant` batch
 * equal to the plan sendUnits. The batch expires at cycle_end. Unused monthly
 * units do not roll. One-off send packs last 12 months. Recurring send packs
 * grant extra units each cycle and expire with that cycle.
 *
 * Feature ladder:
 * - All plans (Starter+): core builder + welcome / new-subscriber automations
 * - Growth+: saved lists, logic filters, A/B subjects, richer analytics
 * - Pro: higher caps + comparative reports
 *
 * Stripe price IDs are env placeholders until live products exist.
 */
import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export const CAMPAIGNS_MODULE_KEY = 'campaigns';
export const CAMPAIGNS_ENTITLEMENT_KEY = 'addon_campaigns';

export type CampaignPlanTierId = 'starter' | 'growth' | 'pro';

export const CAMPAIGN_SUBSCRIPTION_TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceGbp: 9,
    maxContacts: 500,
    sendUnits: 5_000,
    planTier: 'starter' as const,
    features: ['core'] as const,
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceGbp: 19,
    maxContacts: 2_500,
    sendUnits: 20_000,
    planTier: 'growth' as const,
    features: ['core', 'growth'] as const,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceGbp: 49,
    maxContacts: 10_000,
    sendUnits: 60_000,
    planTier: 'pro' as const,
    features: ['core', 'growth', 'pro'] as const,
  },
] as const;

/** One-off and/or recurring send top-ups. Per-send cost is worse than Starter. */
export const CAMPAIGN_SEND_PACKS = [
  {
    id: 'send-2k' as const,
    name: '+2,000 sends',
    sendUnits: 2_000,
    oneTime: {
      productId: 'ozer-campaigns-pack-send-2k',
      planId: 'campaigns-pack-send-2k',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_2k,
      priceGbp: 6,
    },
    monthly: {
      productId: 'ozer-campaigns-pack-send-2k',
      planId: 'campaigns-pack-send-2k-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_2k_monthly,
      priceGbp: 5,
    },
  },
  {
    id: 'send-10k' as const,
    name: '+10,000 sends',
    sendUnits: 10_000,
    oneTime: {
      productId: 'ozer-campaigns-pack-send-10k',
      planId: 'campaigns-pack-send-10k',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_10k,
      priceGbp: 24,
    },
    monthly: {
      productId: 'ozer-campaigns-pack-send-10k',
      planId: 'campaigns-pack-send-10k-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_10k_monthly,
      priceGbp: 20,
    },
  },
  {
    id: 'send-50k' as const,
    name: '+50,000 sends',
    sendUnits: 50_000,
    oneTime: {
      productId: 'ozer-campaigns-pack-send-50k',
      planId: 'campaigns-pack-send-50k',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_50k,
      priceGbp: 99,
    },
    monthly: {
      productId: 'ozer-campaigns-pack-send-50k',
      planId: 'campaigns-pack-send-50k-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_50k_monthly,
      priceGbp: 99,
    },
  },
] as const;

/** Recurring contact-cap bumps. Do not grant send units. */
export const CAMPAIGN_CONTACT_BUMPS = [
  {
    id: 'contacts-500' as const,
    name: '+500 contacts',
    maxContacts: 500,
    monthly: {
      productId: 'ozer-campaigns-bump-contacts-500',
      planId: 'campaigns-bump-contacts-500-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_bump_contacts_500_monthly,
      priceGbp: 8,
    },
  },
  {
    id: 'contacts-2500' as const,
    name: '+2,500 contacts',
    maxContacts: 2_500,
    monthly: {
      productId: 'ozer-campaigns-bump-contacts-2500',
      planId: 'campaigns-bump-contacts-2500-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_bump_contacts_2500_monthly,
      priceGbp: 29,
    },
  },
] as const;

export const CAMPAIGN_USAGE_SOFT_WARN_RATIO = 0.8;

export const CIRCULATION_INCLUDED_ALLOWANCE = {
  maxContacts: 250,
  sendUnits: 1_000,
} as const;

export function findCampaignSubscriptionTier(id: string) {
  return CAMPAIGN_SUBSCRIPTION_TIERS.find((tier) => tier.id === id) ?? null;
}

export function campaignTierForPlanId(planId: string): {
  sendUnits: number;
  maxContacts: number;
  planTier: CampaignPlanTierId;
} | null {
  if (planId.startsWith('campaigns-starter')) {
    return {
      sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[0].sendUnits,
      maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[0].maxContacts,
      planTier: 'starter',
    };
  }
  if (planId.startsWith('campaigns-growth')) {
    return {
      sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[1].sendUnits,
      maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[1].maxContacts,
      planTier: 'growth',
    };
  }
  if (planId.startsWith('campaigns-pro')) {
    return {
      sendUnits: CAMPAIGN_SUBSCRIPTION_TIERS[2].sendUnits,
      maxContacts: CAMPAIGN_SUBSCRIPTION_TIERS[2].maxContacts,
      planTier: 'pro',
    };
  }
  return null;
}

export function campaignTierRank(tier: string | null | undefined): number {
  if (tier === 'pro') return 3;
  if (tier === 'growth') return 2;
  if (tier === 'starter') return 1;
  return 0;
}

export function hasCampaignsGrowthFeatures(
  tier: string | null | undefined,
): boolean {
  return campaignTierRank(tier) >= 2;
}

/**
 * Welcome / new-subscriber automations are on every Campaigns plan,
 * including Starter. Gated by `addon_campaigns`, not Growth.
 */
export function hasCampaignsAutomations(
  tier: string | null | undefined,
): boolean {
  return campaignTierRank(tier) >= 1;
}

export function hasCampaignsProFeatures(
  tier: string | null | undefined,
): boolean {
  return campaignTierRank(tier) >= 3;
}

export function nextCampaignUpgradeTier(
  tier: string | null | undefined,
): (typeof CAMPAIGN_SUBSCRIPTION_TIERS)[number] | null {
  if (tier === 'starter') return CAMPAIGN_SUBSCRIPTION_TIERS[1];
  if (tier === 'growth') return CAMPAIGN_SUBSCRIPTION_TIERS[2];
  if (tier === 'pro') return null;
  return CAMPAIGN_SUBSCRIPTION_TIERS[0];
}

export function findCampaignSendPackByPriceId(
  priceId: string | null | undefined,
) {
  if (!priceId) return null;
  for (const pack of CAMPAIGN_SEND_PACKS) {
    if (pack.oneTime.stripePriceId === priceId) {
      return { pack, mode: 'one-time' as const, sendUnits: pack.sendUnits };
    }
    if (pack.monthly.stripePriceId === priceId) {
      return { pack, mode: 'monthly' as const, sendUnits: pack.sendUnits };
    }
  }
  return null;
}

export function findCampaignContactBumpByPriceId(
  priceId: string | null | undefined,
) {
  if (!priceId) return null;
  for (const bump of CAMPAIGN_CONTACT_BUMPS) {
    if (bump.monthly.stripePriceId === priceId) {
      return { bump, maxContacts: bump.maxContacts };
    }
  }
  return null;
}

export function isCampaignSendPackPriceId(priceId: string | null | undefined) {
  return Boolean(findCampaignSendPackByPriceId(priceId));
}

export function isCampaignContactBumpPriceId(
  priceId: string | null | undefined,
) {
  return Boolean(findCampaignContactBumpByPriceId(priceId));
}

const starterPerSend =
  CAMPAIGN_SUBSCRIPTION_TIERS[0].priceGbp /
  CAMPAIGN_SUBSCRIPTION_TIERS[0].sendUnits;

export function assertCampaignPacksWorseThanStarter(): boolean {
  return CAMPAIGN_SEND_PACKS.every((pack) => {
    const oneTime = pack.oneTime.priceGbp / pack.sendUnits;
    const monthly = pack.monthly.priceGbp / pack.sendUnits;
    return oneTime > starterPerSend && monthly > starterPerSend;
  });
}
