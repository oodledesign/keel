import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type RightmoveDisposalStatusRow,
  collectRightmoveUrls,
  sortRightmoveDisposalRows,
} from '~/lib/commercial/rightmove-publish-status';

export async function listRightmoveDisposalStatuses(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveDisposalStatusRow[]> {
  const [
    { data: listings, error: listingsError },
    { data: pubs, error: pubsError },
  ] = await Promise.all([
    client
      .from('commercial_listings')
      .select('id, name, status, updated_at')
      .eq('account_id', accountId)
      .order('name', { ascending: true }),
    client
      .from('commercial_portal_publications')
      .select(
        'listing_id, status, external_id, external_url, last_sync_at, last_error, metadata',
      )
      .eq('account_id', accountId)
      .eq('portal', 'rightmove'),
  ]);

  if (listingsError) throw new Error(listingsError.message);
  if (pubsError) throw new Error(pubsError.message);

  const pubByListing = new Map(
    ((pubs ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.listing_id),
      row,
    ]),
  );

  const rows = ((listings ?? []) as Array<Record<string, unknown>>).map(
    (listing) => {
      const pub = pubByListing.get(String(listing.id));
      const metadata = (pub?.metadata ?? {}) as Record<string, unknown>;
      const urls = collectRightmoveUrls({
        externalUrl: (pub?.external_url as string | null) ?? null,
        metadata,
      });

      return {
        listingId: String(listing.id),
        name: ((listing.name as string | null) ?? '').trim() || 'Untitled',
        listingStatus: String(listing.status ?? ''),
        rightmoveStatus: pub ? String(pub.status ?? '') : 'none',
        externalId: (pub?.external_id as string | null) ?? null,
        urls,
        lastUpdatedAt:
          (pub?.last_sync_at as string | null) ??
          (listing.updated_at as string | null) ??
          null,
        lastError: (pub?.last_error as string | null) ?? null,
      };
    },
  );

  return sortRightmoveDisposalRows(rows);
}
