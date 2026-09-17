import {
  type ListingStatus,
  listingStatusPublishesToPortals,
} from '~/lib/commercial/commercial-constants';

/** Live Rightmove rows are opt-in publications we must keep in sync. */
export function isLiveRightmovePublication(
  status: string | null | undefined,
): boolean {
  return status === 'published';
}

export function shouldUnpublishRightmoveForListingStatus(
  status: ListingStatus,
): boolean {
  return !listingStatusPublishesToPortals(status);
}

export type RightmoveLiveSyncAction = 'unpublish' | 'enqueue' | 'skip';

/**
 * Live listings stay on Rightmove via a 15-minute flush, not an immediate PUT.
 * Off-market statuses still unpublish immediately so sold/let stock is not left live.
 */
export function resolveRightmoveLiveSyncAction(input: {
  publicationStatus: string | null | undefined;
  listingStatus?: ListingStatus | string | null;
}): RightmoveLiveSyncAction {
  if (!isLiveRightmovePublication(input.publicationStatus)) return 'skip';
  if (
    input.listingStatus &&
    shouldUnpublishRightmoveForListingStatus(
      input.listingStatus as ListingStatus,
    )
  ) {
    return 'unpublish';
  }
  return 'enqueue';
}

function parseTime(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when Rightmove is live but last_sync_at is older than the listing
 * (or newest media created_at). Website/EACH pull times are not stored.
 */
export function isRightmoveSyncStale(input: {
  publicationStatus: string | null | undefined;
  lastSyncAt: string | null | undefined;
  listingUpdatedAt: string | null | undefined;
  mediaCreatedAt?: Array<string | null | undefined>;
}): boolean {
  if (!isLiveRightmovePublication(input.publicationStatus)) return false;

  const lastSync = parseTime(input.lastSyncAt);
  if (lastSync == null) return true;

  const listingUpdated = parseTime(input.listingUpdatedAt) ?? 0;
  const newestMedia = (input.mediaCreatedAt ?? []).reduce((latest, value) => {
    const ms = parseTime(value);
    return ms != null && ms > latest ? ms : latest;
  }, 0);

  return Math.max(listingUpdated, newestMedia) > lastSync;
}
