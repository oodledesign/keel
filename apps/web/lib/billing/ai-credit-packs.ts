import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export type OzerAiCreditPack = {
  productId: string;
  planId: string;
  stripePriceId: string;
  name: string;
  description: string;
  credits: number;
  priceGbp: number;
};

/** One-time AI credit packs — available on personal and workspace billing. */
export const OZER_AI_CREDIT_PACKS: OzerAiCreditPack[] = [
  {
    productId: 'ozer-ai-credits-boost',
    planId: 'ai-credits-boost',
    stripePriceId: OZER_STRIPE_PRICES.ai_credits_boost,
    name: 'Boost',
    description: '2,000 extra AI credits — never expire with the monthly reset.',
    credits: 2_000,
    priceGbp: 5,
  },
  {
    productId: 'ozer-ai-credits-studio',
    planId: 'ai-credits-studio',
    stripePriceId: OZER_STRIPE_PRICES.ai_credits_studio,
    name: 'Studio',
    description: '5,000 extra AI credits for a busy month.',
    credits: 5_000,
    priceGbp: 10,
  },
  {
    productId: 'ozer-ai-credits-agency',
    planId: 'ai-credits-agency',
    stripePriceId: OZER_STRIPE_PRICES.ai_credits_agency,
    name: 'Agency',
    description: '12,000 extra AI credits for heavy team usage.',
    credits: 12_000,
    priceGbp: 20,
  },
];

export function findAiCreditPackByPriceId(
  stripePriceId: string | null | undefined,
): OzerAiCreditPack | null {
  if (!stripePriceId) return null;
  return (
    OZER_AI_CREDIT_PACKS.find((pack) => pack.stripePriceId === stripePriceId) ??
    null
  );
}

export function findAiCreditPackByPlanId(
  planId: string | null | undefined,
): OzerAiCreditPack | null {
  if (!planId) return null;
  return OZER_AI_CREDIT_PACKS.find((pack) => pack.planId === planId) ?? null;
}

export function isAiCreditPackProductId(productId: string | null | undefined) {
  if (!productId) return false;
  return OZER_AI_CREDIT_PACKS.some((pack) => pack.productId === productId);
}
