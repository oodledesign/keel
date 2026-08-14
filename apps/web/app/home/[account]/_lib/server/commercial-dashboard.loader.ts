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

export type CommercialDashboardListingAgent = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

export type CommercialDashboardListing = {
  id: string;
  name: string;
  status: string;
  disposalType: string;
  town: string | null;
  postcode: string | null;
  updatedAt: string;
  coverUrl: string | null;
  agents: CommercialDashboardListingAgent[];
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

  const baseListings = (
    (listingsResult.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    disposalType: row.disposal_type as string,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    updatedAt: row.updated_at as string,
    coverUrl: null as string | null,
    agents: [] as CommercialDashboardListingAgent[],
  }));

  const [withCovers, withAgents] = await Promise.all([
    attachCoverUrls(client, baseListings),
    attachActingAgents(client, accountId, baseListings),
  ]);

  const agentsById = new Map(withAgents.map((l) => [l.id, l.agents]));
  const recentListings = withCovers.map((listing) => ({
    ...listing,
    agents: agentsById.get(listing.id) ?? [],
  }));

  return {
    accountSlug,
    accountId,
    metrics,
    recentListings,
    matchDigest,
  };
}

async function attachActingAgents(
  client: SupabaseClient,
  accountId: string,
  listings: CommercialDashboardListing[],
): Promise<CommercialDashboardListing[]> {
  if (listings.length === 0) return listings;

  const listingIds = listings.map((listing) => listing.id);
  // commercial_* junction may lag generated Database types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentRows, error } = await (client as any)
    .from('commercial_listing_agents')
    .select('listing_id, user_id, sort_order')
    .eq('account_id', accountId)
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[commercial-dashboard] acting agents:', error.message);
    return listings;
  }

  const rows = (agentRows ?? []) as Array<{
    listing_id: string;
    user_id: string;
    sort_order: number;
  }>;
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const memberById = new Map<
    string,
    { name: string; pictureUrl: string | null }
  >();

  if (userIds.length > 0) {
    const { data: accounts } = await client
      .from('accounts')
      .select('id, name, picture_url')
      .in('id', userIds);
    for (const row of accounts ?? []) {
      memberById.set(row.id as string, {
        name: (row.name as string)?.trim() || 'Team member',
        pictureUrl: (row.picture_url as string | null) ?? null,
      });
    }
  }

  const agentsByListing = new Map<string, CommercialDashboardListingAgent[]>();
  for (const row of rows) {
    const member = memberById.get(row.user_id);
    if (!member) continue;
    const list = agentsByListing.get(row.listing_id) ?? [];
    list.push({
      userId: row.user_id,
      name: member.name,
      pictureUrl: member.pictureUrl,
    });
    agentsByListing.set(row.listing_id, list);
  }

  return listings.map((listing) => ({
    ...listing,
    agents: agentsByListing.get(listing.id) ?? [],
  }));
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
