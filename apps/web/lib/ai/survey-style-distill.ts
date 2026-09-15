import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import { heuristicStyleNotes } from '~/lib/building-surveyor/style-extract';

export type StyleDistillResult = {
  styleNotes: string;
  source: 'ai' | 'heuristic_fallback';
  fallbackReason?: string;
};

const SYSTEM_PROMPT = `You distill the writing style of a UK chartered building surveyor's past report.

Return ONLY valid JSON:
{
  "styleNotes": "..."
}

Rules:
- British English.
- Describe voice, sentence length, how defects are phrased, how recommendations are given, and any recurring boilerplate.
- Quote two or three short example phrases from the source.
- Do not invent property facts. Do not write a new report.`;

export async function distillSurveyStyleNotes(input: {
  extractedText: string;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<StyleDistillResult> {
  const fallback = heuristicStyleNotes(input.extractedText);
  const excerpt = input.extractedText.slice(0, 18_000);
  if (!excerpt.trim()) {
    return { styleNotes: fallback, source: 'heuristic_fallback' };
  }

  try {
    const text = await callAI({
      feature: 'survey_style_distill',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({ report_excerpt: excerpt }),
      accountId: input.accountId,
      supabase: input.supabase,
    });
    const parsed = JSON.parse(extractJsonObject(text)) as {
      styleNotes?: string;
    };
    const notes = parsed.styleNotes?.trim();
    if (!notes) {
      return {
        styleNotes: fallback,
        source: 'heuristic_fallback',
        fallbackReason: 'The model returned empty style notes.',
      };
    }
    return { styleNotes: notes.slice(0, 8_000), source: 'ai' };
  } catch (error) {
    return {
      styleNotes: fallback,
      source: 'heuristic_fallback',
      fallbackReason: isInsufficientCreditsError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI style distill unavailable',
    };
  }
}

export function combineSurveyStyleGuidance(
  examples: Array<{ title: string; styleNotes: string | null }>,
): string {
  const parts = examples
    .map((example) => {
      const notes = example.styleNotes?.trim();
      if (!notes) return null;
      return `### ${example.title}\n${notes}`;
    })
    .filter(Boolean);

  return parts.join('\n\n').slice(0, 12_000);
}
