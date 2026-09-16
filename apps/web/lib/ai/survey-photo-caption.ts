import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import {
  SURVEY_PHOTO_CAPTION_SYSTEM_PROMPT,
  applyCaptionsIfEmpty,
  parseSurveyPhotoCaptions,
} from '~/lib/ai/survey-photo-caption-parse';

export type SurveyPhotoCaptionResult = {
  captions: Map<string, string>;
  source: 'ai' | 'skipped' | 'passthrough';
  fallbackReason?: string;
};

export async function captionEmptySurveyPhotos(input: {
  photos: Array<{
    id: string;
    title: string;
    caption?: string | null;
  }>;
  observationText: string;
  sectionKey: string;
  ricsCode?: string | null;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<SurveyPhotoCaptionResult> {
  const uncapped = input.photos.filter((photo) => !photo.caption?.trim());
  if (uncapped.length === 0) {
    return { captions: new Map(), source: 'skipped' };
  }

  try {
    const text = await callAI({
      feature: 'survey_photo_caption',
      systemPrompt: SURVEY_PHOTO_CAPTION_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        sectionKey: input.sectionKey,
        ricsCode: input.ricsCode ?? null,
        observations: input.observationText.slice(0, 4_000),
        photos: uncapped.map((photo) => ({
          docId: photo.id,
          title: photo.title,
        })),
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });

    return {
      captions: applyCaptionsIfEmpty(
        input.photos,
        parseSurveyPhotoCaptions(text),
      ),
      source: 'ai',
    };
  } catch (error) {
    return {
      captions: new Map(),
      source: 'passthrough',
      fallbackReason: isInsufficientCreditsError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI captions unavailable',
    };
  }
}
