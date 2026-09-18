/**
 * Campaigns add-on pricing (GBP). Distinct from Signatures, Media Generate,
 * and commercial Circulation — never merge those pools.
 *
 * Monthly send allotment: each paid invoice grants a `monthly_grant` batch
 * equal to the plan sendUnits. The batch expires at cycle_end. Unused monthly
 * units do not roll. One-off send packs last 12 months. Recurring send packs
 * grant extra units each cycle and expire with that cycle. Contact bumps and
 * send packs stack (quantity on the subscription line, or repeat checkout).
 *
 * Feature ladder:
 * - All plans (Starter+ / Business Lite + Campaigns add-on): core builder,
 *   welcome automations, Audiences hub, manual saved lists, CSV lists
 * - Growth+: logic filters, A/B subjects, richer analytics, categories
 * - Pro: higher caps + comparative reports
 * - Scale: Growth+ and Pro capabilities, 30k contacts / 360k sends
 *
 * Campaigns plans are monthly-only (no yearly SKUs). Soft cap: sends and
 * contact adds stop at entitlement until the workspace buys a pack.
 *
 * Stripe price IDs are env placeholders until live products exist.
 */
import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export const CAMPAIGNS_MODULE_KEY = 'campaigns';
export const CAMPAIGNS_ENTITLEMENT_KEY = 'addon_campaigns';

export type CampaignPlanTierId = 'starter' | 'growth' | 'pro' | 'scale';

export const CAMPAIGN_SUBSCRIPTION_TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceGbp: 9,
    maxContacts: 500,
    sendUnits: 5_000,
    planTier: 'starter' as const,
    monthlyStripePriceId: OZER_STRIPE_PRICES.addon_campaigns_starter_monthly,
    features: ['core'] as const,
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceGbp: 19,
    maxContacts: 2_500,
    sendUnits: 20_000,
    planTier: 'growth' as const,
    monthlyStripePriceId: OZER_STRIPE_PRICES.addon_campaigns_growth_monthly,
    features: ['core', 'growth'] as const,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceGbp: 49,
    maxContacts: 10_000,
    sendUnits: 60_000,
    planTier: 'pro' as const,
    monthlyStripePriceId: OZER_STRIPE_PRICES.addon_campaigns_pro_monthly,
    features: ['core', 'growth', 'pro'] as const,
  },
  {
    id: 'scale' as const,
    name: 'Scale',
    priceGbp: 149,
    maxContacts: 30_000,
    sendUnits: 360_000,
    planTier: 'scale' as const,
    monthlyStripePriceId: OZER_STRIPE_PRICES.addon_campaigns_scale_monthly,
    features: ['core', 'growth', 'pro'] as const,
  },
] as const;

/** One-off and/or recurring send top-ups. Small packs stay worse than Starter. */
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
  {
    id: 'send-200k' as const,
    name: '+200,000 sends',
    sendUnits: 200_000,
    oneTime: {
      productId: 'ozer-campaigns-pack-send-200k',
      planId: 'campaigns-pack-send-200k',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_200k,
      priceGbp: 79,
    },
    monthly: {
      productId: 'ozer-campaigns-pack-send-200k',
      planId: 'campaigns-pack-send-200k-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_200k_monthly,
      priceGbp: 69,
    },
  },
  {
    id: 'send-500k' as const,
    name: '+500,000 sends',
    sendUnits: 500_000,
    oneTime: {
      productId: 'ozer-campaigns-pack-send-500k',
      planId: 'campaigns-pack-send-500k',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_500k,
      priceGbp: 179,
    },
    monthly: {
      productId: 'ozer-campaigns-pack-send-500k',
      planId: 'campaigns-pack-send-500k-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_pack_send_500k_monthly,
      priceGbp: 149,
    },
  },
] as const;

/** Recurring contact-cap bumps. Do not grant send units. Stackable. */
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
    id: 'contacts-2000' as const,
    name: '+2,000 contacts',
    maxContacts: 2_000,
    monthly: {
      productId: 'ozer-campaigns-bump-contacts-2000',
      planId: 'campaigns-bump-contacts-2000-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_bump_contacts_2000_monthly,
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
  {
    id: 'contacts-10000' as const,
    name: '+10,000 contacts',
    maxContacts: 10_000,
    monthly: {
      productId: 'ozer-campaigns-bump-contacts-10000',
      planId: 'campaigns-bump-contacts-10000-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_bump_contacts_10000_monthly,
      priceGbp: 29,
    },
  },
  {
    id: 'contacts-50000' as const,
    name: '+50,000 contacts',
    maxContacts: 50_000,
    monthly: {
      productId: 'ozer-campaigns-bump-contacts-50000',
      planId: 'campaigns-bump-contacts-50000-monthly',
      stripePriceId: OZER_STRIPE_PRICES.campaigns_bump_contacts_50000_monthly,
      priceGbp: 99,
    },
  },
] as const;

export const CAMPAIGN_USAGE_SOFT_WARN_RATIO = 0.8;

export const CIRCULATION_INCLUDED_ALLOWANCE = {
  maxContacts: 250,
  sendUnits: 1_000,
} as const;

/** Starter–Pro send packs; larger Scale packs use volume pricing below Starter. */
const STARTER_PRO_SEND_PACK_MAX_UNITS = 50_000;

export function findCampaignSubscriptionTier(id: string) {
  return CAMPAIGN_SUBSCRIPTION_TIERS.find((tier) => tier.id === id) ?? null;
}

export function campaignTierForPlanId(planId: string): {
  sendUnits: number;
  maxContacts: number;
  planTier: CampaignPlanTierId;
} | null {
  const tier = CAMPAIGN_SUBSCRIPTION_TIERS.find((item) =>
    planId.startsWith(`campaigns-${item.id}`),
  );
  if (!tier) return null;
  return {
    sendUnits: tier.sendUnits,
    maxContacts: tier.maxContacts,
    planTier: tier.planTier,
  };
}

export function campaignTierRank(tier: string | null | undefined): number {
  const index = CAMPAIGN_SUBSCRIPTION_TIERS.findIndex(
    (item) => item.id === tier,
  );
  return index >= 0 ? index + 1 : 0;
}

export function hasCampaignsGrowthFeatures(
  tier: string | null | undefined,
): boolean {
  return campaignTierRank(tier) >= 2;
}

/**
 * Audiences hub, manual saved lists, and CSV lists are on every Campaigns
 * plan, including Starter / Business Lite + Campaigns add-on.
 */
export function hasCampaignsSavedLists(
  tier: string | null | undefined,
): boolean {
  return campaignTierRank(tier) >= 1;
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
  const index = CAMPAIGN_SUBSCRIPTION_TIERS.findIndex(
    (item) => item.id === tier,
  );
  if (index < 0) return CAMPAIGN_SUBSCRIPTION_TIERS[0];
  return CAMPAIGN_SUBSCRIPTION_TIERS[index + 1] ?? null;
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
  return CAMPAIGN_SEND_PACKS.filter(
    (pack) => pack.sendUnits <= STARTER_PRO_SEND_PACK_MAX_UNITS,
  ).every((pack) => {
    const oneTime = pack.oneTime.priceGbp / pack.sendUnits;
    const monthly = pack.monthly.priceGbp / pack.sendUnits;
    return oneTime > starterPerSend && monthly > starterPerSend;
  });
}
