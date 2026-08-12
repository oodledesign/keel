import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { callAI } from '~/lib/ai/router';
import type { DisposalType } from '~/lib/commercial/commercial-constants';
import { extractJson } from '~/lib/websites/extract-json';

/** Slim pair payload for AI explain/outreach (avoids app↔lib coupling). */
export type MatchSuggestionForAi = {
  listingId: string;
  requirementId: string;
  score: number;
  reasons: string[];
  listingName: string;
  listingSector: string | null;
  listingTown: string | null;
  listingDisposalType: DisposalType;
  listingSizeMinSqft: number | null;
  listingSizeMaxSqft: number | null;
  requirementLabel: string;
  requirementSector: string | null;
  requirementLocationText: string | null;
  requirementTenure: 'rent' | 'buy' | 'both' | null;
  requirementSizeMinSqft: number | null;
  requirementSizeMaxSqft: number | null;
  aiWhyFit?: string | null;
  aiRecommendation?: 'add' | 'skip' | 'review' | null;
};
const ExplainItemSchema = z.object({
  listingId: z.string().uuid(),
  requirementId: z.string().uuid(),
  whyFit: z.string().min(1).max(600),
  softScore: z.number().min(0).max(100).optional(),
  recommendation: z.enum(['add', 'skip', 'review']).optional(),
});

const ExplainResponseSchema = z.object({
  items: z.array(ExplainItemSchema).max(20),
});

const OutreachResponseSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(1200),
});

export type MatchExplainItem = z.infer<typeof ExplainItemSchema>;
export type MatchOutreachDraft = z.infer<typeof OutreachResponseSchema>;

const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          listingId: { type: 'string' },
          requirementId: { type: 'string' },
          whyFit: { type: 'string' },
          softScore: { type: 'number' },
          recommendation: {
            type: 'string',
            enum: ['add', 'skip', 'review'],
          },
        },
        required: ['listingId', 'requirementId', 'whyFit'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

const OUTREACH_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['subject', 'body'],
  additionalProperties: false,
} as const;

function suggestionPayload(s: MatchSuggestionForAi) {
  return {
    listingId: s.listingId,
    requirementId: s.requirementId,
    score: s.score,
    reasons: s.reasons,
    listing: {
      name: s.listingName,
      sector: s.listingSector,
      town: s.listingTown,
      disposalType: s.listingDisposalType,
      sizeMinSqft: s.listingSizeMinSqft,
      sizeMaxSqft: s.listingSizeMaxSqft,
    },
    requirement: {
      label: s.requirementLabel,
      sector: s.requirementSector,
      locationText: s.requirementLocationText,
      tenure: s.requirementTenure,
      sizeMinSqft: s.requirementSizeMinSqft,
      sizeMaxSqft: s.requirementSizeMaxSqft,
    },
  };
}

function parseExplain(rawText: string): MatchExplainItem[] {
  let parsed: unknown;
  try {
    parsed = extractJson<unknown>(rawText);
  } catch {
    parsed = JSON.parse(rawText);
  }
  const result = ExplainResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `AI match explain failed validation: ${result.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
    );
  }
  return result.data.items;
}

/** Re-rank / explain top rule-based suggestions with a short "why this fit". */
export async function explainMatchSuggestions<
  T extends MatchSuggestionForAi,
>(input: {
  accountId: string;
  supabase: SupabaseClient;
  suggestions: T[];
  mode?: 'explain' | 'triage';
}): Promise<T[]> {
  const suggestions = input.suggestions.slice(0, 12);
  if (suggestions.length === 0) return [];

  const triage = input.mode === 'triage';
  const systemPrompt = `You are a UK commercial agency desk assistant.
Given scored disposal↔requirement pairs (already rule-scored), return JSON only.
For each item write a concise whyFit (1–2 sentences, UK English) using only the provided facts — do not invent sizes, rents, or locations.
${
  triage
    ? 'Also set recommendation: "add" if a clear fit for Interest Schedule, "skip" if mismatched, "review" if uncertain. softScore may nudge 0–100.'
    : 'Optionally set softScore (0–100) and recommendation add|skip|review when confidence is clear.'
}
Keep IDs exactly as provided.`;

  const userPrompt = JSON.stringify(
    { pairs: suggestions.map(suggestionPayload) },
    null,
    2,
  );

  const rawText = await callAI({
    feature: triage ? 'commercial_match_triage' : 'commercial_match_explain',
    systemPrompt,
    userPrompt,
    accountId: input.accountId,
    supabase: input.supabase,
    responseSchema: EXPLAIN_SCHEMA as unknown as Record<string, unknown>,
  });

  const items = parseExplain(rawText);
  const byKey = new Map(
    items.map((item) => [`${item.listingId}:${item.requirementId}`, item]),
  );

  return suggestions
    .map((s) => {
      const item = byKey.get(`${s.listingId}:${s.requirementId}`);
      if (!item) return s;
      const soft =
        item.softScore != null && Number.isFinite(item.softScore)
          ? Math.round(item.softScore)
          : null;
      const blended =
        soft != null ? Math.round(s.score * 0.65 + soft * 0.35) : s.score;
      return {
        ...s,
        score: Math.max(0, Math.min(100, blended)),
        aiWhyFit: item.whyFit,
        aiRecommendation: item.recommendation ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Draft a short outreach email for one disposal ↔ requirement pair. */
export async function draftMatchOutreach(input: {
  accountId: string;
  supabase: SupabaseClient;
  suggestion: MatchSuggestionForAi;
  agentName?: string | null;
}): Promise<MatchOutreachDraft> {
  const systemPrompt = `You draft short UK commercial agency outreach emails.
Return JSON { subject, body }. UK English. No invented facts. Keep body under 180 words.
Tone: professional, warm, not salesy. Include a clear next step (call or viewing).`;

  const userPrompt = JSON.stringify(
    {
      agentName: input.agentName ?? null,
      pair: suggestionPayload(input.suggestion),
      whyFit: input.suggestion.aiWhyFit ?? input.suggestion.reasons,
    },
    null,
    2,
  );

  const rawText = await callAI({
    feature: 'commercial_match_outreach',
    systemPrompt,
    userPrompt,
    accountId: input.accountId,
    supabase: input.supabase,
    responseSchema: OUTREACH_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: unknown;
  try {
    parsed = extractJson<unknown>(rawText);
  } catch {
    parsed = JSON.parse(rawText);
  }
  const result = OutreachResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('AI outreach draft failed validation');
  }
  return result.data;
}
