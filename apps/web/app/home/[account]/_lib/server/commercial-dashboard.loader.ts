import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  COMMERCIAL_LISTING_MEDIA_BUCKET,
  resolveCommercialMediaPublicUrl,
} from '~/lib/commercial/migrate-external-listing-media';

import {
  type CommercialReportsMetrics,
  createCommercialReportsService,
} from '../../commercial-reports/_lib/server/commercial-reports.service';
import {
  type MatchSuggestion,
  createMatchSuggestionsService,
} from '../../listings/_lib/server/match-suggestions.service';
import { loadTeamWorkspace } from './team-account-workspace.loader';

export type CommercialDashboardListing = {
  id: string;
  name: string;
  status: string;
  disposalType: string;
  town: string | null;
  postcode: string | null;
  updatedAt: string;
  coverUrl: string | null;
};

export type CommercialDashboardData = {
  accountSlug: string;
  accountId: string;
  metrics: CommercialReportsMetrics;
  recentListings: CommercialDashboardListing[];
  matchDigest: {
    count: number;
    suggestions: MatchSuggestion[];
  };
};

export async function loadCommercialDashboardData(
  accountSlug: string,
): Promise<CommercialDashboardData> {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  // Untyped until `pnpm supabase:web:typegen` includes commercial_* tables.
  const client = getSupabaseServerClient() as unknown as SupabaseClient;

  const [metrics, listingsResult, matchDigest] = await Promise.all([
    createCommercialReportsService(client).getMetrics(accountId),
    client
      .from('commercial_listings')
      .select('id, name, status, disposal_type, town, postcode, updated_at')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(6),
    createMatchSuggestionsService(client).deskDigest({
      accountId,
      limit: 5,
      requirementDays: 45,
    }),
  ]);

  if (listingsResult.error) {
    console.error(
      '[commercial-dashboard] recent listings:',
      listingsResult.error.message,
    );
  }

  const recentListings = await attachCoverUrls(
    client,
    ((listingsResult.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: row.id as string,
        name: row.name as string,
        status: row.status as string,
        disposalType: row.disposal_type as string,
        town: (row.town as string | null) ?? null,
        postcode: (row.postcode as string | null) ?? null,
        updatedAt: row.updated_at as string,
        coverUrl: null,
      }),
    ),
  );

  return {
    accountSlug,
    accountId,
    metrics,
    recentListings,
    matchDigest,
  };
}

async function attachCoverUrls(
  client: SupabaseClient,
  listings: CommercialDashboardListing[],
): Promise<CommercialDashboardListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((listing) => listing.id);
  const { data: mediaRows, error } = await client
    .from('commercial_listing_media')
    .select('listing_id, storage_path, external_url, is_cover, sort_order')
    .in('listing_id', listingIds)
    .eq('is_private', false)
    .or('media_type.eq.image,mime_type.ilike.image/%')
    .order('is_cover', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[commercial-dashboard] cover media:', error.message);
    return listings;
  }

  const coverByListing = new Map<
    string,
    { storagePath: string | null; externalUrl: string | null }
  >();
  for (const row of (mediaRows ?? []) as Array<Record<string, unknown>>) {
    const listingId = row.listing_id as string;
    if (coverByListing.has(listingId)) continue;
    coverByListing.set(listingId, {
      storagePath: (row.storage_path as string | null) ?? null,
      externalUrl: (row.external_url as string | null) ?? null,
    });
  }

  const signed = await Promise.all(
    [...coverByListing.entries()].map(async ([listingId, media]) => {
      let storageSignedUrl: string | null = null;
      if (media.storagePath) {
        const { data, error: signError } = await client.storage
          .from(COMMERCIAL_LISTING_MEDIA_BUCKET)
          .createSignedUrl(media.storagePath, 3600);
        if (signError) {
          console.error(
            '[commercial-dashboard] signed cover url:',
            signError.message,
          );
        } else {
          storageSignedUrl = data.signedUrl ?? null;
        }
      }
      return [
        listingId,
        resolveCommercialMediaPublicUrl({
          storageSignedUrl,
          externalUrl: media.externalUrl,
        }),
      ] as const;
    }),
  );

  const urlByListing = new Map(signed);
  return listings.map((listing) => ({
    ...listing,
    coverUrl: urlByListing.get(listing.id) ?? null,
  }));
}
