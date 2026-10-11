import 'server-only';

import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';
import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';

const TTL_MS = 60_000;
const MAX_ENTRIES = 50;

const cache = new Map<
  string,
  { loadedAt: number; data: Promise<PublicBrochureData | null> }
>();

/**
 * Listing data for the wizard's live page preview, reused for a minute so
 * each edit doesn't refetch media, nearby places and branding. The cache
 * skips the RLS read, so callers must check access to the listing first.
 */
export function loadBrochurePreviewData(
  listingId: string,
  accountId: string,
): Promise<PublicBrochureData | null> {
  const key = `${accountId}:${listingId}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.loadedAt < TTL_MS) return hit.data;

  const data = loadListingBrochureData(listingId, accountId).then(
    (result) => {
      if (!result) cache.delete(key);
      return result;
    },
    (err: unknown) => {
      cache.delete(key);
      throw err;
    },
  );
  cache.delete(key);
  cache.set(key, { loadedAt: now, data });
  for (const [oldest, entry] of cache) {
    if (cache.size <= MAX_ENTRIES && now - entry.loadedAt < TTL_MS) break;
    cache.delete(oldest);
  }
  return data;
}
