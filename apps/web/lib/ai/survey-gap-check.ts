import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';
import {
  type SurveyGapFlag,
  parseSurveyGapCheckResponse,
} from '~/lib/building-surveyor/survey-report-gap-check';

import { SURVEY_GAP_CHECK_SYSTEM_PROMPT } from './survey-gap-check-parse';

export async function confirmSurveyGapCheckWithAi(input: {
  accountId: string;
  supabase: SupabaseClient;
  flags: SurveyGapFlag[];
  sections: Array<{
    key: string;
    ricsCode: string;
    label: string;
    hasNotes: boolean;
    photoCount: number;
  }>;
}): Promise<{ flags: SurveyGapFlag[]; source: 'ai' | 'passthrough' }> {
  try {
    const text = await callAI({
      feature: 'survey_gap_check',
      systemPrompt: SURVEY_GAP_CHECK_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        instruction:
          'Confirm or add missed consistency flags. Do not rewrite content.',
        deterministicFlags: input.flags,
        sections: input.sections,
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });
    return { flags: parseSurveyGapCheckResponse(text), source: 'ai' };
  } catch {
    return { flags: [], source: 'passthrough' };
  }
}
