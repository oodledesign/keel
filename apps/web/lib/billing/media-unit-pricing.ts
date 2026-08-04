/**
 * Media unit pricing (GBP). Independent from Ozer AI text credits — never convert 1:1.
 *
 * Provider (fal.ai) costs are USD. FX assumption is explicit and should be revisited
 * if GBP/USD moves materially — it is not a trusted constant indefinitely.
 */

export const MEDIA_UNIT_COST_USD = 0.01;
/** Assumed FX: £1 = $1.34 ⇒ USD→GBP factor = 1/1.34 */
export const MEDIA_ASSUMED_USD_PER_GBP = 1.34;
export const MEDIA_UNIT_COST_GBP =
  MEDIA_UNIT_COST_USD / MEDIA_ASSUMED_USD_PER_GBP; // ≈ 0.0075

export const MEDIA_MODULE_KEY = 'media_generate';
export const MEDIA_ENTITLEMENT_KEY = 'addon_media_generate';

export type MediaPlanTierId = 'starter' | 'studio' | 'agency';

export const MEDIA_SUBSCRIPTION_TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceGbp: 5,
    units: 220,
    planTier: 'starter',
  },
  {
    id: 'studio' as const,
    name: 'Studio',
    priceGbp: 14,
    units: 600,
    planTier: 'studio',
  },
  {
    id: 'agency' as const,
    name: 'Agency',
    priceGbp: 35,
    units: 1500,
    planTier: 'agency',
  },
] as const;

export const MEDIA_TOPUP_PACKS = [
  {
    id: 'small' as const,
    name: 'Small',
    priceGbp: 7.5,
    units: 200,
  },
  {
    id: 'large' as const,
    name: 'Large',
    priceGbp: 20,
    units: 500,
  },
] as const;

/** Top-up per-unit must be worse than Starter subscription (£5/220 ≈ £0.0227). */
const starterPerUnit =
  MEDIA_SUBSCRIPTION_TIERS[0].priceGbp / MEDIA_SUBSCRIPTION_TIERS[0].units;

export function assertTopupWorseThanStarter(): boolean {
  return MEDIA_TOPUP_PACKS.every(
    (pack) => pack.priceGbp / pack.units > starterPerUnit,
  );
}

/** Model unit costs — draft cheap sync image, quality image, video per second. */
export const MEDIA_MODEL_UNIT_COSTS = {
  'fal-ai/flux/schnell': { kind: 'image' as const, units: 2 },
  'fal-ai/flux/dev': { kind: 'image' as const, units: 10 },
  'fal-ai/minimax/video-01': {
    kind: 'video_per_second' as const,
    unitsPerSecond: 25,
  },
} as const;

export type MediaModelId = keyof typeof MEDIA_MODEL_UNIT_COSTS;

export function estimateJobCost(
  modelId: string,
  params: { durationSeconds?: number } = {},
): number {
  const recipe =
    MEDIA_MODEL_UNIT_COSTS[modelId as MediaModelId] ??
    MEDIA_MODEL_UNIT_COSTS['fal-ai/flux/schnell'];

  if (recipe.kind === 'image') {
    return recipe.units;
  }

  const seconds = Math.max(1, Math.ceil(params.durationSeconds ?? 5));
  return recipe.unitsPerSecond * seconds;
}

export function findMediaSubscriptionTier(id: string) {
  return MEDIA_SUBSCRIPTION_TIERS.find((t) => t.id === id) ?? null;
}

export function findMediaTopupPack(id: string) {
  return MEDIA_TOPUP_PACKS.find((p) => p.id === id) ?? null;
}
