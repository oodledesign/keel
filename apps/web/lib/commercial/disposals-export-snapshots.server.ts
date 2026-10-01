import 'server-only';

import { createHash } from 'node:crypto';

import { type LooseClient } from '~/lib/retainers/loose-client';

import type { DisposalsExportOptions } from './disposals-export';
import {
  type Snapshot,
  type StoredSnapshots,
} from './disposals-export-changes';

/**
 * One baseline per person and per set of offices and statuses: comparing an
 * all-offices export with a Tunbridge Wells one would call everything "new".
 */
export function userSnapshotKey(
  userId: string,
  options: Pick<DisposalsExportOptions, 'statuses' | 'officeIds'>,
): string {
  const scope = JSON.stringify({
    s: [...options.statuses].sort(),
    o: [...options.officeIds].sort(),
  });
  const hash = createHash('sha1').update(scope).digest('hex').slice(0, 16);
  return `user:${userId}:${hash}`;
}

export function scheduleSnapshotKey(scheduleId: string): string {
  return `schedule:${scheduleId}`;
}

export async function loadStoredSnapshots(
  db: LooseClient,
  accountId: string,
  key: string,
): Promise<StoredSnapshots | null> {
  const { data, error } = await db
    .from('commercial_export_snapshots')
    .select('snapshot, taken_at, previous_snapshot, previous_taken_at')
    .eq('account_id', accountId)
    .eq('snapshot_key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    snapshot: (data.snapshot ?? {}) as Snapshot,
    takenAt: String(data.taken_at),
    previousSnapshot: (data.previous_snapshot as Snapshot | null) ?? null,
    previousTakenAt: (data.previous_taken_at as string | null) ?? null,
  };
}

/** Make `snapshot` the new baseline; the old one is kept as "previous". */
export async function rollSnapshotForward(
  db: LooseClient,
  params: {
    accountId: string;
    key: string;
    snapshot: Snapshot;
    stored: StoredSnapshots | null;
    now: Date;
  },
): Promise<void> {
  const { error } = await db.from('commercial_export_snapshots').upsert(
    {
      account_id: params.accountId,
      snapshot_key: params.key,
      snapshot: params.snapshot,
      taken_at: params.now.toISOString(),
      previous_snapshot: params.stored?.snapshot ?? null,
      previous_taken_at: params.stored?.takenAt ?? null,
    },
    { onConflict: 'account_id,snapshot_key' },
  );
  if (error) throw new Error(error.message);
}
