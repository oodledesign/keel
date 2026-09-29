/**
 * Re-notify rules: when a listing a contact was already sent changes
 * materially, it can count as "new" for them again. The database trigger only
 * stamps the listing (price_dropped_at / relisted_at); this module decides, at
 * send time, whether those stamps should matter.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Older changes are ignored so switching a toggle on never resurrects old news. */
export const REMATCH_WINDOW_DAYS = 14;

export type ListingChangeKind = 'price_drop' | 'relisted';

export type RematchSettings = {
  onPriceDrop: boolean;
  onRelist: boolean;
};

export type ListingChange = {
  kind: ListingChangeKind;
  /** ISO timestamp of the change. */
  changedAt: string;
};

export const CHANGE_KIND_LABELS: Record<ListingChangeKind, string> = {
  price_drop: 'Price reduced',
  relisted: 'Back on the market',
};

/**
 * The most recent change per listing that currently counts: the workspace
 * toggle for that kind is on and the change is recent. Keyed by listing id.
 * A listing can carry both kinds; the later one is reported.
 */
export function activeListingChanges(
  listings: ReadonlyArray<{
    listingId: string;
    changes: ReadonlyArray<ListingChange>;
  }>,
  settings: RematchSettings,
  now = new Date(),
): Map<string, ListingChange> {
  const active = new Map<string, ListingChange>();
  const cutoff = now.getTime() - REMATCH_WINDOW_DAYS * DAY_MS;

  for (const { listingId, changes } of listings) {
    let latest: { change: ListingChange; at: number } | null = null;
    for (const change of changes) {
      if (change.kind === 'price_drop' && !settings.onPriceDrop) continue;
      if (change.kind === 'relisted' && !settings.onRelist) continue;
      const at = Date.parse(change.changedAt);
      if (Number.isNaN(at) || at < cutoff) continue;
      if (!latest || at > latest.at) latest = { change, at };
    }
    if (latest) active.set(listingId, latest.change);
  }

  return active;
}

/** True when the contact was last sent this listing before it changed. */
export function isSentBeforeChange(
  lastSentAt: string,
  change: ListingChange | undefined,
): boolean {
  if (!change) return false;
  const sent = Date.parse(lastSentAt);
  const changed = Date.parse(change.changedAt);
  if (Number.isNaN(sent) || Number.isNaN(changed)) return false;
  return sent < changed;
}
