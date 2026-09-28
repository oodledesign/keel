import { ACTIVE_LISTING_STATUSES_FOR_MATCH } from '~/lib/commercial/match-scoring';

export function listingBecameLiveForCirculation(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  const live = ACTIVE_LISTING_STATUSES_FOR_MATCH as readonly string[];
  const wasLive = Boolean(previousStatus && live.includes(previousStatus));
  const isLive = Boolean(nextStatus && live.includes(nextStatus));
  return isLive && !wasLive;
}

/** Stable id for “the same set of matching listings”. */
export function matchDigestFingerprint(listingIds: string[]): string {
  return [...new Set(listingIds.filter(Boolean))].sort().join(',');
}
