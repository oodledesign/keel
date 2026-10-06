import {
  type ListingStatus,
  listingStatusPublishesToPortals,
} from '~/lib/commercial/commercial-constants';
import type { RightmoveRemovalReason } from '~/lib/commercial/rightmove-types';

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

/** Why a listing came off Rightmove, in Rightmove's own terms. */
export function rightmoveRemovalReasonForStatus(
  status: ListingStatus | string | null | undefined,
): RightmoveRemovalReason {
  switch (status) {
    case 'let':
      return 'LET_BY_US';
    case 'sold':
      return 'SOLD_BY_US';
    case 'withdrawn':
      return 'WITHDRAWN_FROM_MARKET';
    default:
      return 'REMOVED';
  }
}

/** A failed removal is retried after this long, so a blip is not hammered. */
export const RIGHTMOVE_REMOVAL_RETRY_AFTER_MS = 60 * 60 * 1000;
/** ...and given up on (left showing its error) after this long. */
export const RIGHTMOVE_REMOVAL_RETRY_GIVE_UP_MS = 72 * 60 * 60 * 1000;

/** Publication stage when the lettings property is live but the sale side failed. */
export const RIGHTMOVE_SALE_SIDE_ERROR_STAGE = 'sale_side_error';

/** Live lettings property whose sale side failed, still worth retrying. */
export function isRightmoveSaleSideRetryDue(
  input: {
    listingStatus: string;
    publicationStatus: string | null | undefined;
    stage?: string | null;
    updatedAt?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!listingStatusPublishesToPortals(input.listingStatus)) return false;
  if (
    input.publicationStatus !== 'error' ||
    input.stage !== RIGHTMOVE_SALE_SIDE_ERROR_STAGE
  ) {
    return false;
  }
  const updated = parseTime(input.updatedAt);
  if (updated == null) return false;
  const age = now.getTime() - updated;
  return (
    age >= RIGHTMOVE_REMOVAL_RETRY_AFTER_MS &&
    age <= RIGHTMOVE_REMOVAL_RETRY_GIVE_UP_MS
  );
}

/**
 * Off-market listing that Rightmove may still be showing: still marked live,
 * or a removal that failed recently enough to be worth retrying.
 */
export function isRightmoveRemovalPending(
  input: {
    listingStatus: string;
    publicationStatus: string | null | undefined;
    stage?: string | null;
    updatedAt?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (listingStatusPublishesToPortals(input.listingStatus)) return false;
  if (input.publicationStatus === 'published') return true;
  // The lettings side went up but the sale side failed, so it is still live.
  if (
    input.publicationStatus === 'error' &&
    input.stage === RIGHTMOVE_SALE_SIDE_ERROR_STAGE
  ) {
    return true;
  }
  if (input.publicationStatus !== 'error' || input.stage !== 'delete_error') {
    return false;
  }
  const updated = parseTime(input.updatedAt);
  if (updated == null) return false;
  const age = now.getTime() - updated;
  return (
    age >= RIGHTMOVE_REMOVAL_RETRY_AFTER_MS &&
    age <= RIGHTMOVE_REMOVAL_RETRY_GIVE_UP_MS
  );
}
