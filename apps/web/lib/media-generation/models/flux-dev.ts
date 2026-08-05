import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

export const FLUX_DEV_MODEL_ID = 'fal-ai/flux/dev' as const;

export type FluxDevInput = {
  prompt: string;
  image_size?: string;
  num_inference_steps?: number;
  num_images?: number;
  guidance_scale?: number;
  seed?: number;
};

export type FluxDevResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  seed?: number;
};

/** Text-only quality tier. Never used when reference images are attached. */
export const fluxDevRecipe = {
  modelId: FLUX_DEV_MODEL_ID,
  type: 'image' as const,
  sync: true,
  unitsPerGeneration: () => estimateJobCost(FLUX_DEV_MODEL_ID),
  providerCostUsdEstimate: 0.03,
  supportsSeed: true as const,
  buildInput(params: { prompt: string; seed?: number | null }): FluxDevInput {
    return {
      prompt: params.prompt,
      num_inference_steps: 28,
      num_images: 1,
      image_size: 'landscape_4_3',
      guidance_scale: 3.5,
      ...(typeof params.seed === 'number' ? { seed: params.seed } : {}),
    };
  },
  extractOutputUrl(response: FluxDevResponse): string | null {
    return response.images?.[0]?.url ?? null;
  },
  extractSeed(response: FluxDevResponse): number | null {
    return typeof response.seed === 'number' ? response.seed : null;
  },
};
