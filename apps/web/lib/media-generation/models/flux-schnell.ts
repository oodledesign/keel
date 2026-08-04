import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

export const FLUX_SCHNELL_MODEL_ID = 'fal-ai/flux/schnell' as const;

export type FluxSchnellInput = {
  prompt: string;
  image_url?: string;
  image_size?: string;
  num_inference_steps?: number;
  num_images?: number;
};

export type FluxSchnellResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  seed?: number;
};

export const fluxSchnellRecipe = {
  modelId: FLUX_SCHNELL_MODEL_ID,
  type: 'image' as const,
  sync: true,
  /** fal list pricing ~$0.003/MP; charged as 2 media units in our pool. */
  unitsPerGeneration: () => estimateJobCost(FLUX_SCHNELL_MODEL_ID),
  providerCostUsdEstimate: 0.003,
  buildInput(params: {
    prompt: string;
    refImageUrl?: string | null;
  }): FluxSchnellInput {
    const input: FluxSchnellInput = {
      prompt: params.prompt,
      num_inference_steps: 4,
      num_images: 1,
      image_size: 'landscape_4_3',
    };
    if (params.refImageUrl) {
      input.image_url = params.refImageUrl;
    }
    return input;
  },
  extractOutputUrl(response: FluxSchnellResponse): string | null {
    return response.images?.[0]?.url ?? null;
  },
};
