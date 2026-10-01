/**
 * "What changed since last time" for the availability schedule. A snapshot is
 * the few things the admin team cares about per disposal; comparing two
 * snapshots gives new, changed and no-longer-listed disposals. Pure.
 */

export const TRACKED_FIELDS = [
  'availability',
  'address',
  'town',
  'size',
  'price',
] as const;
export type TrackedField = (typeof TRACKED_FIELDS)[number];

export const TRACKED_FIELD_LABELS: Record<TrackedField, string> = {
  availability: 'Availability',
  address: 'Address',
  town: 'Town',
  size: 'Size',
  price: 'Rent or price',
};

export type TrackedRow = Record<TrackedField, string>;

/** Disposal id → what it looked like. */
export type Snapshot = Record<string, TrackedRow>;

export type ChangeBaseline = {
  /** ISO timestamp the baseline was taken. */
  takenAt: string;
  rows: Snapshot;
};

export type FieldChange = {
  field: TrackedField;
  label: string;
  from: string;
  to: string;
};

export type RemovedRow = {
  id: string;
  previous: TrackedRow;
  /** Where it went: "Let", "Moved to Tonbridge", "Removed" … */
  now: string;
};

export type ChangeSet = {
  since: string;
  newIds: Set<string>;
  changedById: Map<string, FieldChange[]>;
  removed: RemovedRow[];
};

/** Same disposal can be reworded trivially; ignore case and spacing. */
function normal(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function diffSnapshots(
  baseline: ChangeBaseline,
  current: Snapshot,
  resolveNow: (id: string) => string,
): ChangeSet {
  const newIds = new Set<string>();
  const changedById = new Map<string, FieldChange[]>();

  for (const [id, row] of Object.entries(current)) {
    const before = baseline.rows[id];
    if (!before) {
      newIds.add(id);
      continue;
    }
    const changes: FieldChange[] = [];
    for (const field of TRACKED_FIELDS) {
      if (normal(before[field]) !== normal(row[field])) {
        changes.push({
          field,
          label: TRACKED_FIELD_LABELS[field],
          from: before[field] ?? '',
          to: row[field] ?? '',
        });
      }
    }
    if (changes.length > 0) changedById.set(id, changes);
  }

  const removed = Object.entries(baseline.rows)
    .filter(([id]) => !(id in current))
    .map(([id, previous]) => ({ id, previous, now: resolveNow(id) }));

  return { since: baseline.takenAt, newIds, changedById, removed };
}

export function countChanges(set: ChangeSet) {
  return {
    added: set.newIds.size,
    changed: set.changedById.size,
    removed: set.removed.length,
  };
}

export function hasChanges(set: ChangeSet): boolean {
  const { added, changed, removed } = countChanges(set);
  return added + changed + removed > 0;
}

/** "2 new, 3 changed, 1 left the list" or "no changes". */
export function summariseChanges(set: ChangeSet): string {
  const { added, changed, removed } = countChanges(set);
  const parts = [
    added ? `${added} new` : null,
    changed ? `${changed} changed` : null,
    removed ? `${removed} left the list` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no changes';
}

/** "Rent or price: £20,000 pa → £22,000 pa" lines for one disposal. */
export function describeFieldChanges(changes: FieldChange[]): string {
  return changes
    .map(
      (change) =>
        `${change.label}: ${change.from.replace(/\n/g, ' / ') || 'none'} → ${change.to.replace(/\n/g, ' / ') || 'none'}`,
    )
    .join('\n');
}

/**
 * Two exports close together belong to the same working session, so the second
 * still compares against what was there before the first.
 */
export const SESSION_WINDOW_MS = 30 * 60 * 1000;

export type StoredSnapshots = {
  snapshot: Snapshot;
  takenAt: string;
  previousSnapshot: Snapshot | null;
  previousTakenAt: string | null;
};

/** Which stored snapshot to compare against, and whether to roll forward. */
export function chooseBaseline(
  stored: StoredSnapshots | null,
  now: Date,
): { baseline: ChangeBaseline | null; rollForward: boolean } {
  if (!stored) return { baseline: null, rollForward: true };
  const age = now.getTime() - new Date(stored.takenAt).getTime();
  if (age < SESSION_WINDOW_MS) {
    return {
      baseline:
        stored.previousSnapshot && stored.previousTakenAt
          ? { takenAt: stored.previousTakenAt, rows: stored.previousSnapshot }
          : null,
      rollForward: false,
    };
  }
  return {
    baseline: { takenAt: stored.takenAt, rows: stored.snapshot },
    rollForward: true,
  };
}
