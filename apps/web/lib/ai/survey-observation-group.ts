import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import {
  BUILDING_SURVEY_SECTIONS,
  type SurveyObservationDraft,
  applyObservationSectionKeys,
  buildingSurveySectionListForPrompt,
  observationsFromTranscript,
  splitTranscriptParagraphs,
} from '~/lib/building-surveyor/report-sections';

export type ObservationGroupingResult = {
  drafts: SurveyObservationDraft[];
  source: 'ai' | 'keyword_fallback';
  fallbackReason?: string;
};

const SYSTEM_PROMPT = `You group UK building-survey site observations onto RICS Home Survey section keys.

Return ONLY valid JSON:
{
  "assignments": [
    { "index": 0, "sectionKey": "windows" }
  ]
}

Rules:
- British English section routing. Use only these keys:
${buildingSurveySectionListForPrompt()}
- Assign every paragraph index exactly once.
- Route by building element, not room. Windows mentioned in several bedrooms belong under windows.
- If a paragraph covers two elements, pick the dominant element.
- Do not invent findings. Do not rewrite the paragraph.`;

export async function groupSurveyObservations(input: {
  transcript: string;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<ObservationGroupingResult> {
  const paragraphs = splitTranscriptParagraphs(input.transcript);
  if (paragraphs.length === 0) {
    return { drafts: [], source: 'keyword_fallback', fallbackReason: 'empty' };
  }

  const keywordDrafts = observationsFromTranscript(input.transcript);

  try {
    const text = await callAI({
      feature: 'survey_observation_group',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        paragraphs: paragraphs.map((body, index) => ({ index, body })),
        required_keys: BUILDING_SURVEY_SECTIONS.map((section) => section.key),
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });

    const parsed = JSON.parse(extractJsonObject(text)) as {
      assignments?: Array<{ index: number; sectionKey: string }>;
    };
    const drafts = applyObservationSectionKeys(
      paragraphs,
      parsed.assignments ?? [],
    );

    if (drafts.length === 0) {
      return {
        drafts: keywordDrafts,
        source: 'keyword_fallback',
        fallbackReason: 'The model returned no usable assignments.',
      };
    }

    return { drafts, source: 'ai' };
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return {
        drafts: keywordDrafts,
        source: 'keyword_fallback',
        fallbackReason: error.message,
      };
    }

    return {
      drafts: keywordDrafts,
      source: 'keyword_fallback',
      fallbackReason:
        error instanceof Error ? error.message : 'AI grouping unavailable',
    };
  }
}
