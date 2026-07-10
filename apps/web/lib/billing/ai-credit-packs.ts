import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export type AiCreditPurchaseMode = 'one-time' | 'monthly';

export type OzerAiCreditPackOffer = {
  productId: string;
  planId: string;
  stripePriceId: string;
  priceGbp: number;
  paymentType: AiCreditPurchaseMode;
};

export type OzerAiCreditPackTier = {
  id: string;
  name: string;
  credits: number;
  oneTime: OzerAiCreditPackOffer;
  monthly: OzerAiCreditPackOffer;
};

/** AI credit packs — one-time top-up or monthly recurring boost. */
export const OZER_AI_CREDIT_PACK_TIERS: OzerAiCreditPackTier[] = [
  {
    id: 'boost',
    name: 'Boost',
    credits: 2_000,
    oneTime: {
      productId: 'ozer-ai-credits-boost',
      planId: 'ai-credits-boost',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_boost,
      priceGbp: 5,
      paymentType: 'one-time',
    },
    monthly: {
      productId: 'ozer-ai-credits-boost',
      planId: 'ai-credits-boost-monthly',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_boost_monthly,
      priceGbp: 5,
      paymentType: 'monthly',
    },
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 5_000,
    oneTime: {
      productId: 'ozer-ai-credits-studio',
      planId: 'ai-credits-studio',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_studio,
      priceGbp: 10,
      paymentType: 'one-time',
    },
    monthly: {
      productId: 'ozer-ai-credits-studio',
      planId: 'ai-credits-studio-monthly',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_studio_monthly,
      priceGbp: 10,
      paymentType: 'monthly',
    },
  },
  {
    id: 'agency',
    name: 'Agency',
    credits: 12_000,
    oneTime: {
      productId: 'ozer-ai-credits-agency',
      planId: 'ai-credits-agency',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_agency,
      priceGbp: 20,
      paymentType: 'one-time',
    },
    monthly: {
      productId: 'ozer-ai-credits-agency',
      planId: 'ai-credits-agency-monthly',
      stripePriceId: OZER_STRIPE_PRICES.ai_credits_agency_monthly,
      priceGbp: 20,
      paymentType: 'monthly',
    },
  },
];

/** @deprecated Use OZER_AI_CREDIT_PACK_TIERS — kept for fulfill lookup by price id. */
export type OzerAiCreditPack = OzerAiCreditPackOffer & {
  name: string;
  description: string;
  credits: number;
};

export const OZER_AI_CREDIT_PACKS: OzerAiCreditPack[] =
  OZER_AI_CREDIT_PACK_TIERS.flatMap((tier) => [
    {
      ...tier.oneTime,
      name: tier.name,
      credits: tier.credits,
      description: tierDescription(tier, 'one-time'),
    },
    {
      ...tier.monthly,
      name: tier.name,
      credits: tier.credits,
      description: tierDescription(tier, 'monthly'),
    },
  ]);

export function tierDescription(
  tier: OzerAiCreditPackTier,
  mode: AiCreditPurchaseMode,
): string {
  const credits = tier.credits.toLocaleString('en-GB');
  if (mode === 'monthly') {
    return `${credits} extra AI credits added every month. Unused purchased credits roll over when your plan pool resets.`;
  }
  return `${credits} extra AI credits added once. Unused purchased credits roll over when your plan pool resets.`;
}

export function findAiCreditPackByPriceId(
  stripePriceId: string | null | undefined,
): (OzerAiCreditPack & { credits: number }) | null {
  if (!stripePriceId) return null;

  for (const tier of OZER_AI_CREDIT_PACK_TIERS) {
    if (tier.oneTime.stripePriceId === stripePriceId) {
      return {
        ...tier.oneTime,
        name: tier.name,
        credits: tier.credits,
        description: tierDescription(tier, 'one-time'),
      };
    }
    if (tier.monthly.stripePriceId === stripePriceId) {
      return {
        ...tier.monthly,
        name: tier.name,
        credits: tier.credits,
        description: tierDescription(tier, 'monthly'),
      };
    }
  }

  return null;
}

export function findAiCreditPackByPlanId(
  planId: string | null | undefined,
): (OzerAiCreditPack & { credits: number }) | null {
  if (!planId) return null;
  return OZER_AI_CREDIT_PACKS.find((pack) => pack.planId === planId) ?? null;
}

export function isAiCreditPackProductId(productId: string | null | undefined) {
  if (!productId) return false;
  return OZER_AI_CREDIT_PACK_TIERS.some(
    (tier) =>
      tier.oneTime.productId === productId ||
      tier.monthly.productId === productId,
  );
}

export function isAiCreditPackPriceId(stripePriceId: string | null | undefined) {
  return Boolean(findAiCreditPackByPriceId(stripePriceId));
}
