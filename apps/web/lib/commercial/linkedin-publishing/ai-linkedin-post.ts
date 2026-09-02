import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { callAI } from '~/lib/ai/router';
import {
  type LinkedInCopyListing,
  appendListingUrl,
  clampHashtags,
  linkedInAiSystemPrompt,
} from '~/lib/commercial/linkedin-publishing/post-copy';
import { extractJson } from '~/lib/websites/extract-json';

const LinkedInPostBodySchema = z.object({
  body: z.string().trim().min(1),
});

export async function generateLinkedInListingPost(input: {
  accountId: string;
  supabase: SupabaseClient;
  listing: LinkedInCopyListing;
  listingUrl: string | null;
}): Promise<string> {
  const userPrompt = `Listing data:\n${JSON.stringify(
    {
      ...input.listing,
      listingUrl: input.listingUrl,
    },
    null,
    2,
  )}`;

  const rawText = await callAI({
    feature: 'commercial_listing_linkedin_post',
    systemPrompt: linkedInAiSystemPrompt(),
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
      parsed = { body: rawText };
    }
  }

  const result = LinkedInPostBodySchema.safeParse(parsed);
  const body = result.success ? result.data.body : String(rawText).trim();
  if (!body) {
    throw new Error('Could not generate a LinkedIn post from the listing');
  }

  return appendListingUrl(clampHashtags(body), input.listingUrl);
}
