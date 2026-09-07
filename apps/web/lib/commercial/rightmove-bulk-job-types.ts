export const RIGHTMOVE_BULK_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type RightmoveBulkJobStatus =
  (typeof RIGHTMOVE_BULK_JOB_STATUSES)[number];

export type RightmoveBulkJob = {
  id: string;
  accountId: string;
  status: RightmoveBulkJobStatus;
  listingIds: string[];
  cursor: number;
  total: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
  lastListingId: string | null;
  lastListingName: string | null;
  failureNames: string[];
  startedAt: string;
  heartbeatAt: string;
  lockedUntil: string | null;
  completedAt: string | null;
};

export type RightmoveBulkJobPublic = Omit<RightmoveBulkJob, 'listingIds'> & {
  processed: number;
  isActive: boolean;
};

export const STALE_HEARTBEAT_MS = 45_000;

export function isRightmoveBulkJobStale(
  job: Pick<RightmoveBulkJob, 'status' | 'heartbeatAt' | 'lockedUntil'>,
  nowMs = Date.now(),
): boolean {
  if (job.status !== 'queued' && job.status !== 'running') return false;
  const heartbeat = new Date(job.heartbeatAt).getTime();
  if (!Number.isFinite(heartbeat)) return true;
  if (nowMs - heartbeat >= STALE_HEARTBEAT_MS) return true;
  if (!job.lockedUntil) return nowMs - heartbeat >= STALE_HEARTBEAT_MS;
  const lockedUntil = new Date(job.lockedUntil).getTime();
  return Number.isFinite(lockedUntil) && lockedUntil <= nowMs;
}
