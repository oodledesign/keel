import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  disposalIncludesToLet,
  listingStatusPublishesToPortals,
} from '~/lib/commercial/commercial-constants';
import { rightmovePoaFiguresMissing } from '~/lib/commercial/rightmove-mapper';
import {
  type RightmoveDisposalStatusRow,
  collectRightmoveUrls,
  resolveRightmoveDisposalOverviewStatus,
  sortRightmoveDisposalRows,
} from '~/lib/commercial/rightmove-publish-status';

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listRightmoveDisposalStatuses(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveDisposalStatusRow[]> {
  const [
    { data: listings, error: listingsError },
    { data: pubs, error: pubsError },
    { data: media, error: mediaError },
  ] = await Promise.all([
    client
      .from('commercial_listings')
      .select(
        'id, name, status, updated_at, disposal_type, asking_rent_pence, asking_price_pence',
      )
      .eq('account_id', accountId)
      .order('name', { ascending: true }),
    client
      .from('commercial_portal_publications')
      .select(
        'listing_id, status, external_id, external_url, last_sync_at, last_error, metadata',
      )
      .eq('account_id', accountId)
      .eq('portal', 'rightmove'),
    client
      .from('commercial_listing_media')
      .select('listing_id, created_at')
      .eq('account_id', accountId)
      .eq('is_private', false),
  ]);

  if (listingsError) throw new Error(listingsError.message);
  if (pubsError) throw new Error(pubsError.message);
  if (mediaError) throw new Error(mediaError.message);

  // A lettings disposal with no rent of its own may still take one from its
  // units, so only those listings need their units read.
  const needsUnits = ((listings ?? []) as Array<Record<string, unknown>>)
    .filter(
      (l) =>
        disposalIncludesToLet(String(l.disposal_type ?? '') as never) &&
        !(Number(l.asking_rent_pence) > 0),
    )
    .map((l) => String(l.id));
  const unitsByListing = new Map<string, Array<Record<string, unknown>>>();
  for (let i = 0; i < needsUnits.length; i += 50) {
    const { data: units, error: unitsError } = await client
      .from('commercial_listing_units')
      .select('listing_id, asking_rent_pence, rent_per_sqft, size_sqft')
      .in('listing_id', needsUnits.slice(i, i + 50));
    if (unitsError) throw new Error(unitsError.message);
    for (const unit of (units ?? []) as Array<Record<string, unknown>>) {
      const key = String(unit.listing_id);
      unitsByListing.set(key, [...(unitsByListing.get(key) ?? []), unit]);
    }
  }

  const pubByListing = new Map(
    ((pubs ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.listing_id),
      row,
    ]),
  );
  const mediaByListing = new Map<string, string[]>();
  for (const row of (media ?? []) as Array<Record<string, unknown>>) {
    const listingId = String(row.listing_id);
    const createdAt =
      typeof row.created_at === 'string' ? row.created_at : null;
    if (!createdAt) continue;
    const current = mediaByListing.get(listingId) ?? [];
    current.push(createdAt);
    mediaByListing.set(listingId, current);
  }

  const rows = ((listings ?? []) as Array<Record<string, unknown>>).map(
    (listing) => {
      const pub = pubByListing.get(String(listing.id));
      const metadata = (pub?.metadata ?? {}) as Record<string, unknown>;
      const urls = collectRightmoveUrls({
        externalUrl: (pub?.external_url as string | null) ?? null,
        metadata,
      });
      const listingUpdatedAt = (listing.updated_at as string | null) ?? null;
      const lastSyncAt = (pub?.last_sync_at as string | null) ?? null;
      const rightmoveStatus = pub ? String(pub.status ?? '') : 'none';
      const lastError = (pub?.last_error as string | null) ?? null;
      const externalId = (pub?.external_id as string | null) ?? null;
      const externalUrl = (pub?.external_url as string | null) ?? null;
      const mediaCreatedAt = mediaByListing.get(String(listing.id)) ?? [];

      const missing =
        rightmoveStatus === 'published' ||
        listingStatusPublishesToPortals(String(listing.status ?? ''))
          ? rightmovePoaFiguresMissing({
              disposalType: String(listing.disposal_type ?? '') as never,
              askingRentPence: toNumber(listing.asking_rent_pence),
              askingPricePence: toNumber(listing.asking_price_pence),
              units: (unitsByListing.get(String(listing.id)) ?? []).map(
                (u) => ({
                  askingRentPence: toNumber(u.asking_rent_pence),
                  rentPerSqft: toNumber(u.rent_per_sqft),
                  sizeSqft: toNumber(u.size_sqft),
                }),
              ),
            })
          : { rent: false, sale: false };

      return {
        listingId: String(listing.id),
        name: ((listing.name as string | null) ?? '').trim() || 'Untitled',
        listingStatus: String(listing.status ?? ''),
        rightmoveStatus,
        externalId,
        urls,
        lastUpdatedAt: lastSyncAt ?? listingUpdatedAt,
        lastError,
        missingFigures: [
          ...(missing.rent ? (['lettings'] as const) : []),
          ...(missing.sale ? (['sales'] as const) : []),
        ],
        overviewStatus: resolveRightmoveDisposalOverviewStatus({
          listingStatus: String(listing.status ?? ''),
          listingUpdatedAt,
          rightmoveStatus,
          lastSyncAt,
          lastError,
          externalId,
          externalUrl,
          mediaCreatedAt,
        }),
      };
    },
  );

  return sortRightmoveDisposalRows(rows);
}
