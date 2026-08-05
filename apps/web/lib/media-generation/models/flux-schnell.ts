import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

export const FLUX_SCHNELL_MODEL_ID = 'fal-ai/flux/schnell' as const;

export type FluxSchnellInput = {
  prompt: string;
  image_size?: string;
  num_inference_steps?: number;
  num_images?: number;
  seed?: number;
};

export type FluxSchnellResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  seed?: number;
};

/**
 * Cheapest text-to-image path. Do NOT pass reference images — schnell ignores
 * likeness; identity refs route to Nano Banana edit recipes instead.
 */
export const fluxSchnellRecipe = {
  modelId: FLUX_SCHNELL_MODEL_ID,
  type: 'image' as const,
  sync: true,
  /** fal list pricing ~$0.003/MP; charged as 2 media units in our pool. */
  unitsPerGeneration: () => estimateJobCost(FLUX_SCHNELL_MODEL_ID),
  providerCostUsdEstimate: 0.003,
  supportsSeed: true as const,
  buildInput(params: {
    prompt: string;
    seed?: number | null;
  }): FluxSchnellInput {
    return {
      prompt: params.prompt,
      num_inference_steps: 4,
      num_images: 1,
      image_size: 'landscape_4_3',
      ...(typeof params.seed === 'number' ? { seed: params.seed } : {}),
    };
  },
  extractOutputUrl(response: FluxSchnellResponse): string | null {
    return response.images?.[0]?.url ?? null;
  },
  extractSeed(response: FluxSchnellResponse): number | null {
    return typeof response.seed === 'number' ? response.seed : null;
  },
};
