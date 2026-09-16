import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import {
  SURVEY_TRANSCRIPT_CLEANUP_SYSTEM_PROMPT,
  cleanedTextOrSource,
  parseSurveyTranscriptCleanup,
} from '~/lib/ai/survey-transcript-cleanup-parse';

export type SurveyTranscriptCleanupResult = {
  cleanedText: string;
  source: 'ai' | 'passthrough';
  fallbackReason?: string;
};

export async function cleanSurveyTranscript(input: {
  sourceText: string;
  ricsCode?: string | null;
  sectionKey?: string | null;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<SurveyTranscriptCleanupResult> {
  const sourceText = input.sourceText.trim();
  if (!sourceText) {
    return { cleanedText: '', source: 'passthrough', fallbackReason: 'empty' };
  }

  try {
    const text = await callAI({
      feature: 'survey_transcript_cleanup',
      systemPrompt: SURVEY_TRANSCRIPT_CLEANUP_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        sourceText,
        ricsCode: input.ricsCode ?? null,
        sectionKey: input.sectionKey ?? null,
        instruction:
          'Clean this dictation only. Do not assign or change a section.',
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });

    const cleanedText = cleanedTextOrSource(
      parseSurveyTranscriptCleanup(text),
      sourceText,
    );

    if (!cleanedText) {
      return {
        cleanedText: sourceText,
        source: 'passthrough',
        fallbackReason: 'The model returned no usable text.',
      };
    }

    return { cleanedText, source: 'ai' };
  } catch (error) {
    return {
      cleanedText: sourceText,
      source: 'passthrough',
      fallbackReason: isInsufficientCreditsError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI cleanup unavailable',
    };
  }
}

export async function cleanSurveyObservationBodies<
  T extends { body: string; sectionKey: string; ricsCode?: string | null },
>(input: {
  drafts: T[];
  accountId: string;
  supabase: SupabaseClient;
}): Promise<
  Array<
    T & {
      sourceBody: string;
      cleanupSource: 'ai' | 'passthrough';
    }
  >
> {
  const cleaned = [];
  for (const draft of input.drafts) {
    const result = await cleanSurveyTranscript({
      sourceText: draft.body,
      ricsCode: draft.ricsCode,
      sectionKey: draft.sectionKey,
      accountId: input.accountId,
      supabase: input.supabase,
    });
    cleaned.push({
      ...draft,
      body: result.cleanedText,
      sourceBody: draft.body,
      cleanupSource: result.source,
    });
  }
  return cleaned;
}
