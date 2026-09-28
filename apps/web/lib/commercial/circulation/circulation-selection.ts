const DAY_MS = 24 * 60 * 60 * 1000;

export type SelectableListing = {
  listingId: string;
  score: number;
  autoCirculate: boolean;
};

function byScoreDesc(a: SelectableListing, b: SelectableListing) {
  return b.score - a.score;
}

/** True when the contact has something new worth an email. */
export function hasUnsentListing(
  listings: SelectableListing[],
  sentListingIds: ReadonlySet<string>,
  options?: { requireAutoCirculate?: boolean },
): boolean {
  return listings.some(
    (listing) =>
      !sentListingIds.has(listing.listingId) &&
      (!options?.requireAutoCirculate || listing.autoCirculate),
  );
}

/**
 * Unsent listings first (priority listing leading, then by score), topped up
 * with already-sent ones by score. Empty when nothing is unsent.
 */
export function pickListingsForEmail<T extends SelectableListing>(
  listings: T[],
  sentListingIds: ReadonlySet<string>,
  max: number,
  priorityListingId?: string | null,
): T[] {
  const unsent = listings
    .filter((listing) => !sentListingIds.has(listing.listingId))
    .sort((a, b) => {
      if (priorityListingId) {
        if (a.listingId === priorityListingId) return -1;
        if (b.listingId === priorityListingId) return 1;
      }
      return byScoreDesc(a, b);
    });
  if (unsent.length === 0) return [];

  const alreadySent = listings
    .filter((listing) => sentListingIds.has(listing.listingId))
    .sort(byScoreDesc);

  return [...unsent, ...alreadySent].slice(0, max);
}

/** Contacts emailed at or after this instant are still inside the gap. */
export function minGapCutoff(
  minGapDays: number,
  now = new Date(),
): Date | null {
  if (!Number.isFinite(minGapDays) || minGapDays <= 0) return null;
  return new Date(now.getTime() - minGapDays * DAY_MS);
}

export function isWithinMinGap(
  lastCirculatedAt: string | null,
  minGapDays: number,
  now = new Date(),
): boolean {
  const cutoff = minGapCutoff(minGapDays, now);
  if (!cutoff || !lastCirculatedAt) return false;
  const last = Date.parse(lastCirculatedAt);
  if (Number.isNaN(last)) return false;
  return last >= cutoff.getTime();
}

/** Never-emailed contacts first, then longest since their last email. */
export function orderByLeastRecentlyCirculated<
  T extends { email: string; lastCirculatedAt: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = a.lastCirculatedAt ? Date.parse(a.lastCirculatedAt) : null;
    const bTime = b.lastCirculatedAt ? Date.parse(b.lastCirculatedAt) : null;
    if (aTime == null && bTime != null) return -1;
    if (bTime == null && aTime != null) return 1;
    if (aTime != null && bTime != null && aTime !== bTime) {
      return aTime - bTime;
    }
    return a.email.localeCompare(b.email);
  });
}
