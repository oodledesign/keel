import { FLUX_DEV_MODEL_ID, fluxDevRecipe } from './flux-dev';
import { FLUX_SCHNELL_MODEL_ID, fluxSchnellRecipe } from './flux-schnell';
import {
  NANO_BANANA_DRAFT_MODEL_ID,
  nanoBananaDraftRecipe,
} from './nano-banana-draft';
import {
  NANO_BANANA_QUALITY_MODEL_ID,
  nanoBananaQualityRecipe,
} from './nano-banana-quality';

export type ImageQuality = 'draft' | 'quality';

export type ImageRecipe = {
  modelId: string;
  unitsPerGeneration: () => number;
  providerCostUsdEstimate: number;
  supportsSeed: boolean;
  buildInput: (params: {
    prompt: string;
    refImageUrls: string[];
    seed?: number | null;
  }) => Record<string, unknown>;
  extractOutputUrl: (response: unknown) => string | null;
  extractSeed: (response: unknown) => number | null;
};

/**
 * Model routing:
 * - refs present → Nano Banana edit endpoints (actual image_urls conditioning)
 * - no refs → flux schnell (draft) / flux.dev (quality)
 */
export function resolveImageRecipe(params: {
  hasRefs: boolean;
  quality: ImageQuality;
}): ImageRecipe {
  if (params.hasRefs) {
    if (params.quality === 'quality') {
      return {
        modelId: NANO_BANANA_QUALITY_MODEL_ID,
        unitsPerGeneration: nanoBananaQualityRecipe.unitsPerGeneration,
        providerCostUsdEstimate:
          nanoBananaQualityRecipe.providerCostUsdEstimate,
        supportsSeed: nanoBananaQualityRecipe.supportsSeed,
        buildInput: (input) =>
          nanoBananaQualityRecipe.buildInput(input) as unknown as Record<
            string,
            unknown
          >,
        extractOutputUrl: (response) =>
          nanoBananaQualityRecipe.extractOutputUrl(
            response as Parameters<
              typeof nanoBananaQualityRecipe.extractOutputUrl
            >[0],
          ),
        extractSeed: (response) =>
          nanoBananaQualityRecipe.extractSeed(
            response as Parameters<
              typeof nanoBananaQualityRecipe.extractSeed
            >[0],
          ),
      };
    }

    return {
      modelId: NANO_BANANA_DRAFT_MODEL_ID,
      unitsPerGeneration: nanoBananaDraftRecipe.unitsPerGeneration,
      providerCostUsdEstimate: nanoBananaDraftRecipe.providerCostUsdEstimate,
      supportsSeed: nanoBananaDraftRecipe.supportsSeed,
      buildInput: (input) =>
        nanoBananaDraftRecipe.buildInput(input) as unknown as Record<
          string,
          unknown
        >,
      extractOutputUrl: (response) =>
        nanoBananaDraftRecipe.extractOutputUrl(
          response as Parameters<
            typeof nanoBananaDraftRecipe.extractOutputUrl
          >[0],
        ),
      extractSeed: (response) =>
        nanoBananaDraftRecipe.extractSeed(
          response as Parameters<typeof nanoBananaDraftRecipe.extractSeed>[0],
        ),
    };
  }

  if (params.quality === 'quality') {
    return {
      modelId: FLUX_DEV_MODEL_ID,
      unitsPerGeneration: fluxDevRecipe.unitsPerGeneration,
      providerCostUsdEstimate: fluxDevRecipe.providerCostUsdEstimate,
      supportsSeed: fluxDevRecipe.supportsSeed,
      buildInput: (input) =>
        fluxDevRecipe.buildInput({
          prompt: input.prompt,
          seed: input.seed,
        }) as unknown as Record<string, unknown>,
      extractOutputUrl: (response) =>
        fluxDevRecipe.extractOutputUrl(
          response as Parameters<typeof fluxDevRecipe.extractOutputUrl>[0],
        ),
      extractSeed: (response) =>
        fluxDevRecipe.extractSeed(
          response as Parameters<typeof fluxDevRecipe.extractSeed>[0],
        ),
    };
  }

  return {
    modelId: FLUX_SCHNELL_MODEL_ID,
    unitsPerGeneration: fluxSchnellRecipe.unitsPerGeneration,
    providerCostUsdEstimate: fluxSchnellRecipe.providerCostUsdEstimate,
    supportsSeed: true,
    buildInput: (input) =>
      ({
        prompt: input.prompt,
        num_inference_steps: 4,
        num_images: 1,
        image_size: 'landscape_4_3',
        ...(typeof input.seed === 'number' ? { seed: input.seed } : {}),
      }) as Record<string, unknown>,
    extractOutputUrl: (response) =>
      fluxSchnellRecipe.extractOutputUrl(
        response as Parameters<typeof fluxSchnellRecipe.extractOutputUrl>[0],
      ),
    extractSeed: (response) => {
      const seed = (response as { seed?: number }).seed;
      return typeof seed === 'number' ? seed : null;
    },
  };
}
