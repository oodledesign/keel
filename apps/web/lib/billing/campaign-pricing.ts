/**
 * Campaigns add-on pricing (GBP). Distinct from Signatures and Media Generate.
 * Contact cap is the billed mailing-list size; send units are emails sent.
 * Stripe price IDs are env placeholders until live products exist.
 *
 * Circulation stays on its own commercial allowance — never debit campaign_credit_pools.
 */

export const CAMPAIGNS_MODULE_KEY = 'campaigns';
export const CAMPAIGNS_ENTITLEMENT_KEY = 'addon_campaigns';

export type CampaignPlanTierId = 'starter' | 'growth' | 'pro';

export const CAMPAIGN_USAGE_SOFT_WARN_RATIO = 0.8;

export const CAMPAIGN_SUBSCRIPTION_TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceGbp: 9,
    maxContacts: 500,
    sendUnits: 5000,
    planTier: 'starter',
    features: {
      coreCampaigns: true,
      audiences: true,
      sendTest: true,
      basicAnalytics: true,
      customFrom: true,
      savedLists: false,
      abSubjects: false,
      richAnalytics: false,
    },
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceGbp: 19,
    maxContacts: 2500,
    sendUnits: 20000,
    planTier: 'growth',
    features: {
      coreCampaigns: true,
      audiences: true,
      sendTest: true,
      basicAnalytics: true,
      customFrom: true,
      savedLists: true,
      abSubjects: true,
      richAnalytics: true,
    },
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceGbp: 49,
    maxContacts: 10000,
    sendUnits: 60000,
    planTier: 'pro',
    features: {
      coreCampaigns: true,
      audiences: true,
      sendTest: true,
      basicAnalytics: true,
      customFrom: true,
      savedLists: true,
      abSubjects: true,
      richAnalytics: true,
    },
  },
] as const;

/**
 * One-off send top-ups. Per-send rate is worse than Starter (£9 / 5,000).
 * Expire 6 months from purchase (same pattern as media top-ups).
 */
export const CAMPAIGN_SEND_TOPUP_PACKS = [
  {
    id: 'sends-2k' as const,
    name: '+2,000 sends',
    sendUnits: 2000,
    priceGbp: 6,
    productId: 'ozer-campaigns-topup-sends-2k',
    planId: 'campaigns-topup-sends-2k',
  },
  {
    id: 'sends-10k' as const,
    name: '+10,000 sends',
    sendUnits: 10000,
    priceGbp: 24,
    productId: 'ozer-campaigns-topup-sends-10k',
    planId: 'campaigns-topup-sends-10k',
  },
  {
    id: 'sends-50k' as const,
    name: '+50,000 sends',
    sendUnits: 50000,
    priceGbp: 99,
    productId: 'ozer-campaigns-topup-sends-50k',
    planId: 'campaigns-topup-sends-50k',
  },
] as const;

/**
 * One-off contact-cap bumps. Persist on the pool (not reset each cycle).
 */
export const CAMPAIGN_CONTACT_BUMP_PACKS = [
  {
    id: 'contacts-500' as const,
    name: '+500 contacts',
    contacts: 500,
    priceGbp: 8,
    productId: 'ozer-campaigns-topup-contacts-500',
    planId: 'campaigns-topup-contacts-500',
  },
  {
    id: 'contacts-2500' as const,
    name: '+2,500 contacts',
    contacts: 2500,
    priceGbp: 29,
    productId: 'ozer-campaigns-topup-contacts-2500',
    planId: 'campaigns-topup-contacts-2500',
  },
] as const;

export type CampaignFeatureFlags = {
  [K in keyof (typeof CAMPAIGN_SUBSCRIPTION_TIERS)[number]['features']]: boolean;
};

const NO_CAMPAIGN_FEATURES: CampaignFeatureFlags = {
  coreCampaigns: false,
  audiences: false,
  sendTest: false,
  basicAnalytics: false,
  customFrom: false,
  savedLists: false,
  abSubjects: false,
  richAnalytics: false,
};

export function findCampaignSubscriptionTier(id: string) {
  return CAMPAIGN_SUBSCRIPTION_TIERS.find((tier) => tier.id === id) ?? null;
}

export function findCampaignSendTopupPack(id: string) {
  return CAMPAIGN_SEND_TOPUP_PACKS.find((pack) => pack.id === id) ?? null;
}

export function findCampaignContactBumpPack(id: string) {
  return CAMPAIGN_CONTACT_BUMP_PACKS.find((pack) => pack.id === id) ?? null;
}

export function normalizeCampaignPlanTier(
  value: string | null | undefined,
): CampaignPlanTierId | 'none' {
  if (value === 'starter' || value === 'growth' || value === 'pro') {
    return value;
  }
  return 'none';
}

export function campaignTierRank(
  tier: CampaignPlanTierId | 'none' | string,
): number {
  if (tier === 'starter') return 1;
  if (tier === 'growth') return 2;
  if (tier === 'pro') return 3;
  return 0;
}

export function campaignFeaturesForTier(
  tier: CampaignPlanTierId | 'none' | string,
): CampaignFeatureFlags {
  const id = normalizeCampaignPlanTier(tier);
  if (id === 'none') {
    return NO_CAMPAIGN_FEATURES;
  }
  return findCampaignSubscriptionTier(id)?.features ?? NO_CAMPAIGN_FEATURES;
}

export function nextCampaignUpgradeTier(
  tier: CampaignPlanTierId | 'none' | string,
): (typeof CAMPAIGN_SUBSCRIPTION_TIERS)[number] | null {
  const rank = campaignTierRank(tier);
  return (
    CAMPAIGN_SUBSCRIPTION_TIERS.find(
      (item) => campaignTierRank(item.id) > rank,
    ) ?? null
  );
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

/** Effective list-size cap. 0 max_contacts = unlimited (admin grants). */
export function effectiveCampaignContactCap(input: {
  maxContacts: number;
  bonusContacts?: number;
}): number {
  if (input.maxContacts <= 0) return 0;
  return input.maxContacts + Math.max(0, input.bonusContacts ?? 0);
}

export function campaignUsageMeter(input: { used: number; cap: number }): {
  used: number;
  cap: number;
  remaining: number;
  ratio: number;
  softWarning: boolean;
  hardBlocked: boolean;
  unlimited: boolean;
} {
  const unlimited = input.cap <= 0;
  const used = Math.max(0, input.used);
  const cap = Math.max(0, input.cap);
  const remaining = unlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, cap - used);
  const ratio = unlimited || cap === 0 ? 0 : used / cap;
  return {
    used,
    cap,
    remaining: unlimited ? Number.POSITIVE_INFINITY : remaining,
    ratio,
    softWarning:
      !unlimited && ratio >= CAMPAIGN_USAGE_SOFT_WARN_RATIO && ratio < 1,
    hardBlocked: !unlimited && used >= cap,
    unlimited,
  };
}
