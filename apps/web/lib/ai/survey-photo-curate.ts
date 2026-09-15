import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import {
  MAX_CURATED_PHOTOS_PER_SECTION,
  type SurveyPhotoCandidate,
  type SurveyPhotoCuration,
  type SurveyPhotoObservation,
  proposeCuratedPhotosHeuristic,
  sanitisePhotoCuration,
} from '~/lib/building-surveyor/photo-curate';
import {
  BUILDING_SURVEY_SECTIONS,
  buildingSurveySectionListForPrompt,
} from '~/lib/building-surveyor/report-sections';

export type PhotoCurationResult = {
  items: SurveyPhotoCuration[];
  source: 'ai' | 'keyword_fallback';
  fallbackReason?: string;
};

const SYSTEM_PROMPT = `You choose a small curated set of site photographs for a UK building survey report.

Return ONLY valid JSON:
{
  "photos": [
    {
      "docId": "<uuid>",
      "sectionKey": "windows",
      "caption": "Cracked putty to the lower sash."
    }
  ]
}

Rules:
- British English captions.
- Only use the supplied photo ids and section keys.
- Only curate sections that have observations.
- About 3–4 photos per section that has report text. Skip empty sections.
- Do not reuse a photo in more than one section.
- Captions must be grounded in the section observations. Do not invent defects from the filename alone.
- Prefer filenames that mention the element (roof, window, damp, and so on).
${buildingSurveySectionListForPrompt()}`;

export async function curateSurveyPhotos(input: {
  photos: SurveyPhotoCandidate[];
  observations: SurveyPhotoObservation[];
  accountId: string;
  supabase: SupabaseClient;
}): Promise<PhotoCurationResult> {
  const fallback = proposeCuratedPhotosHeuristic({
    photos: input.photos,
    observations: input.observations,
  });

  if (input.photos.length === 0 || input.observations.length === 0) {
    return { items: [], source: 'keyword_fallback', fallbackReason: 'empty' };
  }

  try {
    const text = await callAI({
      feature: 'survey_photo_curate',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        max_per_section: MAX_CURATED_PHOTOS_PER_SECTION,
        sections: BUILDING_SURVEY_SECTIONS.map((section) => section.key),
        observations: input.observations.map((item) => ({
          sectionKey: item.sectionKey,
          body: item.body.slice(0, 500),
        })),
        photos: input.photos.map((photo) => ({
          docId: photo.id,
          title: photo.title,
          createdAt: photo.createdAt ?? null,
        })),
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });

    const parsed = JSON.parse(extractJsonObject(text)) as {
      photos?: Array<{
        docId: string;
        sectionKey: string;
        caption?: string;
      }>;
    };

    const items = sanitisePhotoCuration(
      (parsed.photos ?? []).map((photo) => ({
        docId: photo.docId,
        sectionKey: photo.sectionKey,
        caption: photo.caption ?? '',
        sortOrder: 0,
      })),
      input.photos,
      input.observations,
    );

    if (items.length === 0) {
      return {
        items: fallback,
        source: 'keyword_fallback',
        fallbackReason: 'The model returned no usable photo selection.',
      };
    }

    return { items, source: 'ai' };
  } catch (error) {
    return {
      items: fallback,
      source: 'keyword_fallback',
      fallbackReason: isInsufficientCreditsError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI photo curation unavailable',
    };
  }
}
