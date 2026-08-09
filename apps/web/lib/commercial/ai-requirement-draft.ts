import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { callAI } from '~/lib/ai/router';
import { extractJson } from '~/lib/websites/extract-json';

export const RequirementDraftSchema = z.object({
  companyName: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  locationText: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  tenure: z.enum(['rent', 'buy', 'both']).nullable().optional(),
  sizeMinSqft: z.number().nullable().optional(),
  sizeMaxSqft: z.number().nullable().optional(),
  budgetMinPence: z.number().int().nullable().optional(),
  budgetMaxPence: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export type RequirementDraft = z.infer<typeof RequirementDraftSchema>;

export const REQUIREMENT_DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    companyName: { type: ['string', 'null'] },
    contactName: { type: ['string', 'null'] },
    contactEmail: { type: ['string', 'null'] },
    contactPhone: { type: ['string', 'null'] },
    locationText: { type: ['string', 'null'] },
    sector: { type: ['string', 'null'] },
    tenure: {
      anyOf: [
        { type: 'string', enum: ['rent', 'buy', 'both'] },
        { type: 'null' },
      ],
    },
    sizeMinSqft: { type: ['number', 'null'] },
    sizeMaxSqft: { type: ['number', 'null'] },
    budgetMinPence: { type: ['integer', 'null'] },
    budgetMaxPence: { type: ['integer', 'null'] },
    notes: { type: ['string', 'null'] },
    source: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

export type EnquiryDraftContext = {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  message?: string | null;
  areasText?: string | null;
  propertyTypes?: string | null;
  tenure?: string | null;
  targetSizeMinSqft?: number | null;
  targetSizeMaxSqft?: number | null;
  source?: string | null;
};

export type ListingDraftHint = {
  name?: string | null;
  sector?: string | null;
  addressLine1?: string | null;
  town?: string | null;
  postcode?: string | null;
  disposalType?: string | null;
};

function nullishTrim(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function normalizeDraft(raw: RequirementDraft): RequirementDraft {
  const tenure = raw.tenure ?? null;
  return {
    companyName: nullishTrim(raw.companyName ?? null),
    contactName: nullishTrim(raw.contactName ?? null),
    contactEmail: nullishTrim(raw.contactEmail ?? null),
    contactPhone: nullishTrim(raw.contactPhone ?? null),
    locationText: nullishTrim(raw.locationText ?? null),
    sector: nullishTrim(raw.sector ?? null),
    tenure:
      tenure === 'rent' || tenure === 'buy' || tenure === 'both'
        ? tenure
        : null,
    sizeMinSqft:
      raw.sizeMinSqft != null && Number.isFinite(raw.sizeMinSqft)
        ? raw.sizeMinSqft
        : null,
    sizeMaxSqft:
      raw.sizeMaxSqft != null && Number.isFinite(raw.sizeMaxSqft)
        ? raw.sizeMaxSqft
        : null,
    budgetMinPence:
      raw.budgetMinPence != null && Number.isFinite(raw.budgetMinPence)
        ? Math.round(raw.budgetMinPence)
        : null,
    budgetMaxPence:
      raw.budgetMaxPence != null && Number.isFinite(raw.budgetMaxPence)
        ? Math.round(raw.budgetMaxPence)
        : null,
    notes: nullishTrim(raw.notes ?? null),
    source: nullishTrim(raw.source ?? null),
  };
}

export async function draftRequirementFromText(input: {
  accountId: string;
  supabase: SupabaseClient;
  text: string;
  enquiry?: EnquiryDraftContext | null;
  listingHint?: ListingDraftHint | null;
}): Promise<RequirementDraft> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('Paste an enquiry email or message to draft from');
  }

  const enquiryBlock = input.enquiry
    ? [
        'Structured enquiry fields (prefer these when present):',
        JSON.stringify(
          {
            contactName: input.enquiry.contactName ?? null,
            contactEmail: input.enquiry.contactEmail ?? null,
            contactPhone: input.enquiry.contactPhone ?? null,
            areasText: input.enquiry.areasText ?? null,
            propertyTypes: input.enquiry.propertyTypes ?? null,
            tenure: input.enquiry.tenure ?? null,
            targetSizeMinSqft: input.enquiry.targetSizeMinSqft ?? null,
            targetSizeMaxSqft: input.enquiry.targetSizeMaxSqft ?? null,
            source: input.enquiry.source ?? null,
            message: input.enquiry.message ?? null,
          },
          null,
          2,
        ),
      ].join('\n')
    : '';

  const listingBlock = input.listingHint
    ? [
        'Disposal this enquiry relates to (soft context only — do not invent matching requirements):',
        JSON.stringify(input.listingHint, null, 2),
      ].join('\n')
    : '';

  const systemPrompt = `You extract a commercial property Requirement (occupier brief) for a UK agency CRM.
Return ONLY JSON matching the schema. Use null for unknown fields.
Rules:
- Do not invent emails, phone numbers, sizes, or budgets not present in the source.
- tenure must be "rent", "buy", "both", or null.
- budget fields are integer pence (GBP). If amounts are in pounds, convert to pence.
- size fields are numeric square feet.
- Put leftover free-text context in notes.
- source may be a short label like "website", "email", or the enquiry source.`;

  const userPrompt = [
    enquiryBlock,
    listingBlock,
    'Source text:',
    text.slice(0, 12000),
  ]
    .filter(Boolean)
    .join('\n\n');

  const rawText = await callAI({
    feature: 'commercial_requirement_draft',
    systemPrompt,
    userPrompt,
    accountId: input.accountId,
    supabase: input.supabase,
    responseSchema: REQUIREMENT_DRAFT_RESPONSE_SCHEMA as unknown as Record<
      string,
      unknown
    >,
  });

  let parsed: unknown;
  try {
    parsed = extractJson<unknown>(rawText);
  } catch {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Could not parse requirement draft from AI response');
    }
  }

  const result = RequirementDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `AI draft failed validation: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return normalizeDraft(result.data);
}
