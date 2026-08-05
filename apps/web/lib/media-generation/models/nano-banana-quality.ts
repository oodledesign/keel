import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

/** Gemini 3 Pro Image edit — commercial, identity-preserving from image_urls. */
export const NANO_BANANA_QUALITY_MODEL_ID =
  'fal-ai/nano-banana-pro/edit' as const;

export type NanoBananaProEditInput = {
  prompt: string;
  image_urls: string[];
  num_images?: number;
  seed?: number;
  aspect_ratio?: string;
  output_format?: 'png' | 'jpeg' | 'webp';
  safety_tolerance?: string;
  resolution?: '1K' | '2K' | '4K';
  limit_generations?: boolean;
};

export type NanoBananaProEditResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  description?: string;
  seed?: number;
};

/**
 * Quality identity-preserving recipe (~$0.15/image → 15 media units).
 * Separate model id from draft (not the same endpoint with different params).
 */
export const nanoBananaQualityRecipe = {
  modelId: NANO_BANANA_QUALITY_MODEL_ID,
  type: 'image' as const,
  sync: true,
  unitsPerGeneration: () => estimateJobCost(NANO_BANANA_QUALITY_MODEL_ID),
  providerCostUsdEstimate: 0.15,
  supportsSeed: true as const,
  buildInput(params: {
    prompt: string;
    refImageUrls: string[];
    seed?: number | null;
  }): NanoBananaProEditInput {
    if (!params.refImageUrls.length) {
      throw new Error(
        'nano-banana-pro/edit requires at least one reference image',
      );
    }
    return {
      prompt: params.prompt,
      image_urls: params.refImageUrls,
      num_images: 1,
      aspect_ratio: '4:3',
      output_format: 'png',
      resolution: '1K',
      limit_generations: true,
      ...(typeof params.seed === 'number' ? { seed: params.seed } : {}),
    };
  },
  extractOutputUrl(response: NanoBananaProEditResponse): string | null {
    return response.images?.[0]?.url ?? null;
  },
  extractSeed(response: NanoBananaProEditResponse): number | null {
    return typeof response.seed === 'number' ? response.seed : null;
  },
};
