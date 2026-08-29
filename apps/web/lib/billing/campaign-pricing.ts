/**
 * Campaigns add-on pricing (GBP). Distinct from Signatures and Media Generate.
 * Contact cap is the billed mailing-list size; send units are emails sent.
 * Stripe price IDs are env placeholders until live products exist.
 */

export const CAMPAIGNS_MODULE_KEY = 'campaigns';
export const CAMPAIGNS_ENTITLEMENT_KEY = 'addon_campaigns';

export type CampaignPlanTierId = 'starter' | 'growth' | 'pro';

export const CAMPAIGN_SUBSCRIPTION_TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceGbp: 19,
    maxContacts: 500,
    sendUnits: 2000,
    planTier: 'starter',
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceGbp: 49,
    maxContacts: 2500,
    sendUnits: 10000,
    planTier: 'growth',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceGbp: 99,
    maxContacts: 10000,
    sendUnits: 50000,
    planTier: 'pro',
  },
] as const;

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
