import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI } from '~/lib/ai/router';
import {
  BROCHURE_MAPPING_SYSTEM_PROMPT,
  type BrochureMappedPassage,
  parseBrochureMapping,
} from '~/lib/building-surveyor/brochure-import';
import { extractStyleDocumentText } from '~/lib/building-surveyor/style-extract.server';

export async function extractBrochurePdfText(buffer: Buffer): Promise<string> {
  const text = extractStyleDocumentText({
    buffer,
    mimeType: 'application/pdf',
    filename: 'brochure.pdf',
  });
  return text.replace(/\s+/g, ' ').trim();
}

export async function mapBrochureTextToSections(input: {
  brochureText: string;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<BrochureMappedPassage[]> {
  const brochureText = input.brochureText.slice(0, 40_000);
  if (!brochureText) return [];

  const text = await callAI({
    feature: 'survey_brochure_map',
    systemPrompt: BROCHURE_MAPPING_SYSTEM_PROMPT,
    userPrompt: JSON.stringify({
      brochureText,
      instruction:
        'Map brochure passages to location, location_grounds and grounds only.',
    }),
    accountId: input.accountId,
    supabase: input.supabase,
  });

  try {
    return parseBrochureMapping(JSON.parse(extractJsonObject(text)));
  } catch {
    return parseBrochureMapping({ sections: [] });
  }
}
