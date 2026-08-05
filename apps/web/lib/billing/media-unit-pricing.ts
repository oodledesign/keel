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
  /** Text-only draft (flux schnell). */
  'fal-ai/flux/schnell': { kind: 'image' as const, units: 2 },
  /** Text-only quality (flux.dev). */
  'fal-ai/flux/dev': { kind: 'image' as const, units: 10 },
  /**
   * Reference draft — Nano Banana /edit (~$0.039).
   * Adjusted from the original 2-unit draft assumption to match real provider cost.
   */
  'fal-ai/nano-banana/edit': { kind: 'image' as const, units: 4 },
  /**
   * Reference quality — Nano Banana Pro /edit (~$0.15).
   * Adjusted from the original 10-unit quality assumption.
   */
  'fal-ai/nano-banana-pro/edit': { kind: 'image' as const, units: 15 },
  'fal-ai/minimax/video-01': {
    kind: 'video_per_second' as const,
    unitsPerSecond: 25,
  },
} as const;

export type MediaModelId = keyof typeof MEDIA_MODEL_UNIT_COSTS;

export type ImageQualityTier = 'draft' | 'quality';

export const IMAGE_MODEL_ROUTE = {
  textDraft: 'fal-ai/flux/schnell',
  textQuality: 'fal-ai/flux/dev',
  refDraft: 'fal-ai/nano-banana/edit',
  refQuality: 'fal-ai/nano-banana-pro/edit',
} as const satisfies Record<string, MediaModelId>;

/** Shared model selection for UI cost preview and server debit. */
export function resolveImageModelId(
  hasRefs: boolean,
  quality: ImageQualityTier,
): MediaModelId {
  if (hasRefs) {
    return quality === 'quality'
      ? IMAGE_MODEL_ROUTE.refQuality
      : IMAGE_MODEL_ROUTE.refDraft;
  }
  return quality === 'quality'
    ? IMAGE_MODEL_ROUTE.textQuality
    : IMAGE_MODEL_ROUTE.textDraft;
}

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

/** Total units for an image batch — UI and debit must both call this. */
export function estimateImageBatchCost(params: {
  hasRefs: boolean;
  quality: ImageQualityTier;
  variations: number;
}): number {
  const variations = Math.max(1, Math.min(4, Math.floor(params.variations)));
  const modelId = resolveImageModelId(params.hasRefs, params.quality);
  return estimateJobCost(modelId) * variations;
}

export function findMediaSubscriptionTier(id: string) {
  return MEDIA_SUBSCRIPTION_TIERS.find((t) => t.id === id) ?? null;
}

export function findMediaTopupPack(id: string) {
  return MEDIA_TOPUP_PACKS.find((p) => p.id === id) ?? null;
}
