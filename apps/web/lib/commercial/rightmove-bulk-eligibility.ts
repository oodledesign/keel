import { listingStatusPublishesToPortals } from '~/lib/commercial/commercial-constants';
import {
  type RightmoveOverviewStatus,
  resolveRightmoveDisposalOverviewStatus,
} from '~/lib/commercial/rightmove-publish-status';

export const RIGHTMOVE_BULK_SCOPES = ['all', 'unsynced'] as const;

export type RightmoveBulkScope = (typeof RIGHTMOVE_BULK_SCOPES)[number];

export function isRightmoveBulkScope(
  value: string | null | undefined,
): value is RightmoveBulkScope {
  return (RIGHTMOVE_BULK_SCOPES as readonly string[]).includes(value ?? '');
}

export function parseRightmoveBulkScope(
  value: string | null | undefined,
): RightmoveBulkScope {
  return isRightmoveBulkScope(value) ? value : 'all';
}

/**
 * Push all (`all`) keeps today's Marketing / Under offer eligibility,
 * including first-time Not pushed listings.
 * Resync (`unsynced`) is already-live listings that are behind.
 */
export function isRightmoveBulkRowEligible(
  row: {
    listingStatus: string;
    overviewStatus: RightmoveOverviewStatus;
  },
  scope: RightmoveBulkScope = 'all',
): boolean {
  if (!listingStatusPublishesToPortals(row.listingStatus)) return false;
  if (scope === 'all') return true;
  return row.overviewStatus === 'unsynced';
}

/** Cron flush: already-live Unsynced only — never first-time Not pushed. */
export function isRightmoveFlushCandidate(input: {
  listingStatus: string;
  listingUpdatedAt?: string | null;
  rightmoveStatus: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  mediaCreatedAt?: Array<string | null | undefined>;
}): boolean {
  return isRightmoveBulkListingEligible(input, 'unsynced');
}

export function isRightmoveBulkListingEligible(
  input: {
    listingStatus: string;
    listingUpdatedAt?: string | null;
    rightmoveStatus: string;
    lastSyncAt?: string | null;
    lastError?: string | null;
    externalId?: string | null;
    externalUrl?: string | null;
    mediaCreatedAt?: Array<string | null | undefined>;
  },
  scope: RightmoveBulkScope = 'all',
): boolean {
  return isRightmoveBulkRowEligible(
    {
      listingStatus: input.listingStatus,
      overviewStatus: resolveRightmoveDisposalOverviewStatus(input),
    },
    scope,
  );
}

export function selectRightmoveBulkEligibleRows<
  T extends {
    listingStatus: string;
    overviewStatus: RightmoveOverviewStatus;
  },
>(rows: T[], scope: RightmoveBulkScope = 'all'): T[] {
  return rows.filter((row) => isRightmoveBulkRowEligible(row, scope));
}
