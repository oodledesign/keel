import 'server-only';

import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';
import { extractJson } from '~/lib/websites/extract-json';

export const ListingMarketingCopySchema = z.object({
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  locationCopy: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).max(8),
});

export type ListingMarketingCopy = z.infer<typeof ListingMarketingCopySchema>;

export type ListingMarketingSource = {
  name: string;
  disposalType: string | null;
  sector: string | null;
  tenure: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  askingRent: number | null;
  askingPrice: number | null;
  rentFrequency: string | null;
  useClass: string | null;
  availableFrom: string | null;
  epcBand: string | null;
  epcRating: string | number | null;
  existingSummary?: string | null;
  existingDescription?: string | null;
};

export async function generateListingMarketingCopy(input: {
  accountId: string;
  supabase: SupabaseClient;
  listing: ListingMarketingSource;
}): Promise<ListingMarketingCopy> {
  const systemPrompt = `You write UK commercial property marketing copy for an agency disposal listing.
Return ONLY valid JSON:
{
  "summary": "1-2 sentence headline summary",
  "description": "short brochure description (2-4 short paragraphs, plain text)",
  "locationCopy": "1 short paragraph on location/connectivity",
  "keyPoints": ["up to 6 bullet strings"]
}
Rules:
- Use only facts present in the listing data. Do not invent amenities, transport, rents, or sizes.
- Concise agency tone. No emoji. No markdown headings.
- If a fact is missing, omit it rather than guessing.
- Prefer sq ft and £ formatting where numbers are provided.`;

  const userPrompt = `Listing data:\n${JSON.stringify(input.listing, null, 2)}`;

  const rawText = await callAI({
    feature: 'commercial_listing_marketing_copy',
    systemPrompt,
    userPrompt,
    accountId: input.accountId,
    supabase: input.supabase,
  });

  let parsed: unknown;
  try {
    parsed = extractJson<unknown>(rawText);
  } catch {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Could not parse marketing copy from AI response');
    }
  }

  const result = ListingMarketingCopySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `AI marketing copy failed validation: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    summary: result.data.summary.trim(),
    description: result.data.description.trim(),
    locationCopy: result.data.locationCopy.trim(),
    keyPoints: result.data.keyPoints
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 6),
  };
}
