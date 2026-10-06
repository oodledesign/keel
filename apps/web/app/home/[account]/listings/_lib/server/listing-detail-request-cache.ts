import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadWebsiteChannelUrlState } from '~/lib/commercial/listing-website-url-resolve.server';

import type { createListingsService } from './listings.service';

/**
 * A disposal's layout and page render side by side and both need the same
 * publications, media dates and website URL check. Sharing them per request
 * means each query runs once instead of twice.
 */
const requestStore = cache(() => new Map<string, Promise<unknown>>());

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const store = requestStore();
  const hit = store.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const pending = load();
  store.set(key, pending);
  return pending;
}

export function loadListingPublicationsOnce(
  service: ReturnType<typeof createListingsService>,
  listingId: string,
) {
  return once(`publications:${listingId}`, () =>
    service.listPublicationsForListing(listingId),
  );
}

export function loadListingPublicMediaDatesOnce(
  client: SupabaseClient,
  accountId: string,
  listingId: string,
) {
  return once(`media-dates:${accountId}:${listingId}`, async () => {
    const { data } = await client
      .from('commercial_listing_media')
      .select('created_at')
      .eq('listing_id', listingId)
      .eq('account_id', accountId)
      .eq('is_private', false);
    return (data ?? []).map((row) => row.created_at as string);
  });
}

export function loadListingWebsiteUrlStateOnce(
  input: Parameters<typeof loadWebsiteChannelUrlState>[0],
) {
  return once(
    `website-url:${input.accountId}:${input.listingId}:${input.listing.websiteUrl ?? ''}`,
    () => loadWebsiteChannelUrlState(input),
  );
}
