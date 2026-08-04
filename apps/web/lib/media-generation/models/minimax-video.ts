import { estimateJobCost } from '~/lib/billing/media-unit-pricing';

export const MINIMAX_VIDEO_MODEL_ID = 'fal-ai/minimax/video-01' as const;

export type MinimaxVideoInput = {
  prompt: string;
  prompt_optimizer?: boolean;
};

export type MinimaxVideoResponse = {
  video?: { url: string };
};

export const minimaxVideoRecipe = {
  modelId: MINIMAX_VIDEO_MODEL_ID,
  type: 'video' as const,
  sync: false,
  defaultDurationSeconds: 5,
  unitsForDuration(durationSeconds: number) {
    return estimateJobCost(MINIMAX_VIDEO_MODEL_ID, { durationSeconds });
  },
  providerCostUsdPerSecondEstimate: 0.05,
  buildInput(params: { prompt: string }): MinimaxVideoInput {
    return {
      prompt: params.prompt,
      prompt_optimizer: true,
    };
  },
  extractOutputUrl(response: MinimaxVideoResponse): string | null {
    return response.video?.url ?? null;
  },
};
