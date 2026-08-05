import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

/** Gemini 2.5 Flash Image edit — commercial, accepts face/style refs via image_urls. */
export const NANO_BANANA_DRAFT_MODEL_ID = 'fal-ai/nano-banana/edit' as const;

export type NanoBananaEditInput = {
  prompt: string;
  image_urls: string[];
  num_images?: number;
  seed?: number;
  aspect_ratio?: string;
  output_format?: 'png' | 'jpeg' | 'webp';
  safety_tolerance?: string;
  limit_generations?: boolean;
};

export type NanoBananaEditResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  description?: string;
  seed?: number;
};

/**
 * Draft identity-preserving recipe (~$0.039/image → 4 media units).
 * Reference likeness is conveyed only via `image_urls`, never text.
 */
export const nanoBananaDraftRecipe = {
  modelId: NANO_BANANA_DRAFT_MODEL_ID,
  type: 'image' as const,
  sync: true,
  unitsPerGeneration: () => estimateJobCost(NANO_BANANA_DRAFT_MODEL_ID),
  providerCostUsdEstimate: 0.039,
  supportsSeed: true as const,
  buildInput(params: {
    prompt: string;
    refImageUrls: string[];
    seed?: number | null;
  }): NanoBananaEditInput {
    if (!params.refImageUrls.length) {
      throw new Error('nano-banana/edit requires at least one reference image');
    }
    return {
      prompt: params.prompt,
      image_urls: params.refImageUrls,
      num_images: 1,
      aspect_ratio: '4:3',
      output_format: 'png',
      // Prevent prompt-text "4 variations" from becoming a collage.
      limit_generations: true,
      ...(typeof params.seed === 'number' ? { seed: params.seed } : {}),
    };
  },
  extractOutputUrl(response: NanoBananaEditResponse): string | null {
    return response.images?.[0]?.url ?? null;
  },
  extractSeed(response: NanoBananaEditResponse): number | null {
    return typeof response.seed === 'number' ? response.seed : null;
  },
};
