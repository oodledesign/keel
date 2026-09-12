import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { callAI } from '~/lib/ai/router';
import { extractJson } from '~/lib/websites/extract-json';

import type { LadderPools, LadderService } from './types';

const MatchResponseSchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(600),
  proposedName: z.string().max(120).nullable().optional(),
  proposedDescription: z.string().max(400).nullable().optional(),
  proposedCreditCost: z.number().int().min(1).max(1000).nullable().optional(),
});

export type RetainerAiMatch = z.infer<typeof MatchResponseSchema>;

const MATCH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    serviceId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    proposedName: { type: ['string', 'null'] },
    proposedDescription: { type: ['string', 'null'] },
    proposedCreditCost: { type: ['integer', 'null'] },
  },
  required: ['confidence', 'rationale'],
  additionalProperties: false,
} as const;

function formatServices(services: LadderService[]): string {
  if (services.length === 0) return '(none)';
  return services
    .map(
      (service) =>
        `- ${service.id} | ${service.name} | ${service.creditCost} credits | ${service.description ?? ''}`,
    )
    .join('\n');
}

export async function matchRetainerServiceWithFlash(input: {
  accountId: string;
  supabase: SupabaseClient;
  subject: string;
  emailText: string;
  pools: LadderPools;
}): Promise<RetainerAiMatch> {
  const systemPrompt = `You match inbound client emails to a workspace retainer service catalogue.

Ladder:
1. Prefer a service from PROJECT SERVICES when the email clearly requests that work.
2. If none of those fit confidently, pick from WORKSPACE SERVICES (not yet on this project).
3. If nothing fits, propose a new service (short name, one-line description, integer credit cost >= 1). Never invent a serviceId.
4. If the email is not retainer work, set serviceId and proposedName to null.

Return JSON only. Confidence is 0-1. Do not auto-create anything.`;

  const userPrompt = `Subject: ${input.subject.trim() || '(no subject)'}

Email:
${input.emailText.trim().slice(0, 8000) || '(empty)'}

PROJECT SERVICES:
${formatServices(input.pools.projectServices)}

WORKSPACE SERVICES:
${formatServices(input.pools.workspaceOnlyServices)}`;

  const rawText = await callAI({
    feature: 'retainer_service_match',
    systemPrompt,
    userPrompt,
    accountId: input.accountId,
    supabase: input.supabase,
    responseSchema: MATCH_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
  });

  let json: unknown;
  try {
    json = extractJson(rawText);
  } catch {
    json = null;
  }

  const parsed = MatchResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      serviceId: null,
      confidence: 0,
      rationale: 'Could not parse a service match from the email.',
      proposedName: null,
      proposedDescription: null,
      proposedCreditCost: null,
    };
  }

  return parsed.data;
}
