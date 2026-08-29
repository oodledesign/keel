import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  circulateListing,
  listAlreadySentEmails,
  listCirculationCandidates,
  resolveCirculationIdentity,
} from '~/lib/commercial/circulation/circulate-listing';
import { isCirculationAutoEligible } from '~/lib/commercial/circulation/circulation-eligibility';
import { LISTING_ACTIVE_STATUSES } from '~/lib/commercial/commercial-constants';

const MAX_LISTINGS = 40;
const MAX_RECIPIENTS_PER_LISTING = 80;

type AutoListing = {
  id: string;
  account_id: string;
};

export async function runCommercialAutoCirculation(
  admin: SupabaseClient,
): Promise<{
  listings: number;
  mailed: number;
  skipped: number;
  errors: string[];
}> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return {
      listings: 0,
      mailed: 0,
      skipped: 0,
      errors: ['NEXT_PUBLIC_SITE_URL is not configured'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from('commercial_listings')
    .select('id, account_id')
    .eq('auto_circulate_matches', true)
    .in('status', [...LISTING_ACTIVE_STATUSES])
    .limit(MAX_LISTINGS);

  if (error) {
    return {
      listings: 0,
      mailed: 0,
      skipped: 0,
      errors: [error.message],
    };
  }

  const listings = (data ?? []) as AutoListing[];
  let mailed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    try {
      const identity = await resolveCirculationIdentity(
        admin,
        listing.account_id,
      );
      if (!identity.fromEmail) {
        skipped += 1;
        continue;
      }

      const candidates = await listCirculationCandidates(admin, {
        accountId: listing.account_id,
        listingId: listing.id,
      });
      const alreadySent = await listAlreadySentEmails(admin, {
        accountId: listing.account_id,
        listingId: listing.id,
      });

      const requirementIds = candidates
        .filter(
          (c) =>
            isCirculationAutoEligible(c.consentStatus) &&
            !alreadySent.has(c.email),
        )
        .slice(0, MAX_RECIPIENTS_PER_LISTING)
        .map((c) => c.requirementId);

      if (requirementIds.length === 0) {
        skipped += 1;
        continue;
      }

      const result = await circulateListing(admin, {
        accountId: listing.account_id,
        listingId: listing.id,
        requirementIds,
        sentBy: null,
        fromEmail: identity.fromEmail,
        fromName: identity.fromName,
        replyTo: identity.replyTo ?? identity.fromEmail,
        siteUrl,
        sendTrigger: 'auto',
        skipAlreadySent: true,
      });
      mailed += result.sent;
      skipped += result.skipped;
    } catch (err) {
      errors.push(
        `${listing.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    listings: listings.length,
    mailed,
    skipped,
    errors,
  };
}
