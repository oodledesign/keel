import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI } from '~/lib/ai/router';
import {
  BROCHURE_MAPPING_SYSTEM_PROMPT,
  type BrochureMappedPassage,
  parseBrochureMapping,
} from '~/lib/building-surveyor/brochure-import';
import {
  splitBrochureChunks,
  triageBrochureChunksWithJev,
} from '~/lib/building-surveyor/jev-brochure-section-triage';
import { extractStyleDocumentText } from '~/lib/building-surveyor/style-extract.server';

export async function extractBrochurePdfText(buffer: Buffer): Promise<string> {
  const text = extractStyleDocumentText({
    buffer,
    mimeType: 'application/pdf',
    filename: 'brochure.pdf',
  });
  return text.replace(/\s+/g, ' ').trim();
}

const REWRITE_SYSTEM_PROMPT = `You rewrite estate-agent brochure passages into neutral UK surveyor prose.
Return JSON only:
{"sections":[{"sectionKey":"location"|"location_grounds"|"grounds","exactText":"...","rewrittenText":"..."}]}

Rules:
- Keep every sectionKey and exactText unchanged from the input.
- rewrittenText is the same facts in third person, concise surveyor English.
- Do not invent facts.`;

async function rewriteBrochurePassagesWithAi(input: {
  passages: BrochureMappedPassage[];
  accountId: string;
  supabase: SupabaseClient;
}): Promise<BrochureMappedPassage[]> {
  if (input.passages.length === 0) return [];

  try {
    const text = await callAI({
      feature: 'survey_brochure_map',
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        sections: input.passages.map((item) => ({
          sectionKey: item.sectionKey,
          exactText: item.exactText,
        })),
      }),
      accountId: input.accountId,
      supabase: input.supabase,
    });
    const rewritten = parseBrochureMapping(JSON.parse(extractJsonObject(text)));
    if (rewritten.length === 0) return input.passages;

    const byKey = new Map(rewritten.map((item) => [item.sectionKey, item]));
    return input.passages.map((item) => {
      const hit = byKey.get(item.sectionKey);
      if (!hit) return item;
      return {
        ...item,
        rewrittenText: hit.rewrittenText || item.exactText,
      };
    });
  } catch {
    return input.passages;
  }
}

export async function mapBrochureTextToSections(input: {
  brochureText: string;
  accountId: string;
  supabase: SupabaseClient;
}): Promise<BrochureMappedPassage[]> {
  const brochureText = input.brochureText.slice(0, 40_000);
  if (!brochureText) return [];

  // Prefer Jev for section routing (cheap, typed), then Gemini only for rewrite.
  const jevPassages = await triageBrochureChunksWithJev(
    splitBrochureChunks(brochureText),
  );
  if (jevPassages && jevPassages.length > 0) {
    return rewriteBrochurePassagesWithAi({
      passages: jevPassages,
      accountId: input.accountId,
      supabase: input.supabase,
    });
  }

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
