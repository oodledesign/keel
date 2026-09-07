import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { LISTING_PORTAL_PUBLISH_STATUSES } from '~/lib/commercial/commercial-constants';
import {
  publishToRightmove,
  setPortalPublishersClient,
} from '~/lib/commercial/portal-publishers';
import {
  type RightmoveBulkFailureDetail,
  type RightmoveBulkJob,
  type RightmoveBulkJobPublic,
  type RightmoveBulkJobStatus,
  STALE_HEARTBEAT_MS,
} from '~/lib/commercial/rightmove-bulk-job-types';
import { isRightmoveOAuthConfigured } from '~/lib/commercial/rightmove-env';

export {
  STALE_HEARTBEAT_MS,
  isRightmoveBulkJobStale,
} from '~/lib/commercial/rightmove-bulk-job-types';
export type {
  RightmoveBulkJob,
  RightmoveBulkJobPublic,
  RightmoveBulkJobStatus,
} from '~/lib/commercial/rightmove-bulk-job-types';

export type ProcessBulkRightmoveJobResult = {
  jobId: string;
  claimed: boolean;
  completed: boolean;
  processed: number;
  succeeded: number;
  failed: number;
};

const DEFAULT_BATCH_SIZE = 6;
const DEFAULT_DELAY_MS = 300;
const LEASE_MS = 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asFailureDetails(value: unknown): RightmoveBulkFailureDetail[] {
  if (!Array.isArray(value)) return [];
  const details: RightmoveBulkFailureDetail[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const listingId = typeof row.listingId === 'string' ? row.listingId : '';
    const name = typeof row.name === 'string' ? row.name : '';
    const error = typeof row.error === 'string' ? row.error : '';
    if (!listingId && !name && !error) continue;
    details.push({
      listingId,
      name: name || 'Untitled',
      error: error || 'Rightmove publish failed',
    });
  }
  return details.slice(0, 40);
}

function mapJob(row: Record<string, unknown>): RightmoveBulkJob {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    status: row.status as RightmoveBulkJobStatus,
    listingIds: asStringArray(row.listing_ids),
    cursor: Number(row.cursor ?? 0),
    total: Number(row.total ?? 0),
    succeeded: Number(row.succeeded ?? 0),
    failed: Number(row.failed ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    lastListingId: (row.last_listing_id as string | null) ?? null,
    lastListingName: (row.last_listing_name as string | null) ?? null,
    failureNames: asStringArray(row.failure_names),
    failureDetails: asFailureDetails(row.failure_details),
    startedAt: String(row.started_at),
    heartbeatAt: String(row.heartbeat_at),
    lockedUntil: (row.locked_until as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export function toPublicRightmoveBulkJob(
  job: RightmoveBulkJob,
): RightmoveBulkJobPublic {
  return {
    id: job.id,
    accountId: job.accountId,
    status: job.status,
    cursor: job.cursor,
    total: job.total,
    succeeded: job.succeeded,
    failed: job.failed,
    lastError: job.lastError,
    lastListingId: job.lastListingId,
    lastListingName: job.lastListingName,
    failureNames: job.failureNames,
    failureDetails: job.failureDetails,
    startedAt: job.startedAt,
    heartbeatAt: job.heartbeatAt,
    lockedUntil: job.lockedUntil,
    completedAt: job.completedAt,
    processed: Math.min(job.total, job.cursor),
    isActive: job.status === 'queued' || job.status === 'running',
  };
}

export async function loadActiveRightmoveBulkJob(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveBulkJob | null> {
  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .select('*')
    .eq('account_id', accountId)
    .in('status', ['queued', 'running'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapJob(data as Record<string, unknown>) : null;
}

export async function loadLatestRightmoveBulkJob(
  client: SupabaseClient,
  accountId: string,
): Promise<RightmoveBulkJob | null> {
  const active = await loadActiveRightmoveBulkJob(client, accountId);
  if (active) return active;

  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapJob(data as Record<string, unknown>) : null;
}

export async function loadRightmoveBulkJobById(
  client: SupabaseClient,
  jobId: string,
): Promise<RightmoveBulkJob | null> {
  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapJob(data as Record<string, unknown>) : null;
}

async function listEligibleListingIds(
  client: SupabaseClient,
  accountId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await client
    .from('commercial_listings')
    .select('id, name')
    .eq('account_id', accountId)
    .in('status', [...LISTING_PORTAL_PUBLISH_STATUSES])
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() || 'Untitled',
    }),
  );
}

export async function startRightmoveBulkJob(input: {
  client: SupabaseClient;
  accountId: string;
  userId?: string | null;
}): Promise<{ job: RightmoveBulkJob; created: boolean }> {
  if (!isRightmoveOAuthConfigured()) {
    throw new Error(
      'Rightmove ADF credentials not configured (RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY missing on this server)',
    );
  }

  const existing = await loadActiveRightmoveBulkJob(
    input.client,
    input.accountId,
  );
  if (existing) {
    return { job: existing, created: false };
  }

  const listings = await listEligibleListingIds(input.client, input.accountId);
  const now = new Date().toISOString();
  const { data, error } = await input.client
    .from('commercial_rightmove_bulk_jobs')
    .insert({
      account_id: input.accountId,
      status: listings.length === 0 ? 'completed' : 'queued',
      listing_ids: listings.map((row) => row.id),
      cursor: 0,
      total: listings.length,
      succeeded: 0,
      failed: 0,
      failure_names: [],
      failure_details: [],
      started_by: input.userId ?? null,
      started_at: now,
      heartbeat_at: now,
      completed_at: listings.length === 0 ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const raced = await loadActiveRightmoveBulkJob(
        input.client,
        input.accountId,
      );
      if (raced) return { job: raced, created: false };
    }
    throw new Error(error.message);
  }

  return { job: mapJob(data as Record<string, unknown>), created: true };
}

async function claimRightmoveBulkJob(
  client: SupabaseClient,
  jobId: string,
): Promise<RightmoveBulkJob | null> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
  const nowIso = now.toISOString();

  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .update({
      status: 'running',
      locked_until: leaseUntil,
      heartbeat_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', jobId)
    .in('status', ['queued', 'running'])
    .or(`locked_until.is.null,locked_until.lt."${nowIso}"`)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapJob(data as Record<string, unknown>) : null;
}

async function persistJobProgress(
  client: SupabaseClient,
  job: RightmoveBulkJob,
  patch: {
    cursor: number;
    succeeded: number;
    failed: number;
    lastError: string | null;
    lastListingId: string | null;
    lastListingName: string | null;
    failureNames: string[];
    failureDetails: RightmoveBulkFailureDetail[];
    completed: boolean;
    fatal?: boolean;
  },
) {
  const now = new Date().toISOString();
  const status: RightmoveBulkJobStatus = patch.fatal
    ? 'failed'
    : patch.completed
      ? 'completed'
      : 'running';

  const { error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .update({
      status,
      cursor: patch.cursor,
      succeeded: patch.succeeded,
      failed: patch.failed,
      last_error: patch.lastError,
      last_listing_id: patch.lastListingId,
      last_listing_name: patch.lastListingName,
      failure_names: patch.failureNames.slice(0, 40),
      failure_details: patch.failureDetails.slice(0, 40),
      heartbeat_at: now,
      locked_until: null,
      completed_at: patch.completed || patch.fatal ? now : null,
      updated_at: now,
    })
    .eq('id', job.id);

  if (error) throw new Error(error.message);
}

/**
 * Process the next batch of listings for a persisted job.
 * Safe to call from a detached worker, cron, or a returning user's poll.
 */
export async function processRightmoveBulkJobBatch(input: {
  client: SupabaseClient;
  jobId: string;
  limit?: number;
  delayMs?: number;
}): Promise<ProcessBulkRightmoveJobResult> {
  const limit = Math.min(20, Math.max(1, input.limit ?? DEFAULT_BATCH_SIZE));
  const delayMs = Math.max(0, input.delayMs ?? DEFAULT_DELAY_MS);
  const empty: ProcessBulkRightmoveJobResult = {
    jobId: input.jobId,
    claimed: false,
    completed: false,
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  const claimed = await claimRightmoveBulkJob(input.client, input.jobId);
  if (!claimed) {
    const current = await loadRightmoveBulkJobById(input.client, input.jobId);
    return {
      ...empty,
      completed:
        current?.status === 'completed' || current?.status === 'failed',
    };
  }

  if (claimed.cursor >= claimed.total || claimed.listingIds.length === 0) {
    await persistJobProgress(input.client, claimed, {
      cursor: claimed.cursor,
      succeeded: claimed.succeeded,
      failed: claimed.failed,
      lastError: claimed.lastError,
      lastListingId: claimed.lastListingId,
      lastListingName: claimed.lastListingName,
      failureNames: claimed.failureNames,
      failureDetails: claimed.failureDetails,
      completed: true,
    });
    return { ...empty, claimed: true, completed: true };
  }

  const batchIds = claimed.listingIds.slice(
    claimed.cursor,
    claimed.cursor + limit,
  );
  let succeeded = claimed.succeeded;
  let failed = claimed.failed;
  const failureNames = [...claimed.failureNames];
  const failureDetails = [...claimed.failureDetails];
  let lastError = claimed.lastError;
  let lastListingId = claimed.lastListingId;
  let lastListingName = claimed.lastListingName;
  let processed = 0;

  setPortalPublishersClient(input.client);
  try {
    for (let i = 0; i < batchIds.length; i++) {
      const listingId = batchIds[i]!;
      let name = 'Untitled';

      try {
        const { data: listingRow } = await input.client
          .from('commercial_listings')
          .select('id, name')
          .eq('id', listingId)
          .eq('account_id', claimed.accountId)
          .maybeSingle();
        name = ((listingRow?.name as string | null) ?? '').trim() || 'Untitled';

        let publication = await publishToRightmove(
          claimed.accountId,
          listingId,
        );
        if (
          publication.status === 'error' &&
          (publication.last_error ?? '').toLowerCase().includes('rate limit')
        ) {
          await sleep(5_000);
          publication = await publishToRightmove(claimed.accountId, listingId);
        }

        const ok = publication.status !== 'error';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
          lastError = publication.last_error ?? 'Rightmove publish failed';
          if (failureNames.length < 40) failureNames.push(name);
          if (failureDetails.length < 40) {
            failureDetails.push({
              listingId,
              name,
              error: lastError,
            });
          }
        }
      } catch (error) {
        failed += 1;
        lastError =
          error instanceof Error ? error.message : 'Rightmove publish failed';
        if (failureNames.length < 40) failureNames.push(name);
        if (failureDetails.length < 40) {
          failureDetails.push({
            listingId,
            name,
            error: lastError,
          });
        }
      }

      lastListingId = listingId;
      lastListingName = name;
      processed += 1;

      if (i < batchIds.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  } catch (error) {
    await persistJobProgress(input.client, claimed, {
      cursor: claimed.cursor + processed,
      succeeded,
      failed,
      lastError:
        error instanceof Error
          ? error.message
          : 'Bulk Rightmove publish failed',
      lastListingId,
      lastListingName,
      failureNames,
      failureDetails,
      completed: false,
      fatal: true,
    });
    throw error;
  } finally {
    setPortalPublishersClient(null);
  }

  const nextCursor = claimed.cursor + processed;
  const completed = nextCursor >= claimed.total;

  await persistJobProgress(input.client, claimed, {
    cursor: nextCursor,
    succeeded,
    failed,
    lastError,
    lastListingId,
    lastListingName,
    failureNames,
    failureDetails,
    completed,
  });

  return {
    jobId: claimed.id,
    claimed: true,
    completed,
    processed,
    succeeded: succeeded - claimed.succeeded,
    failed: failed - claimed.failed,
  };
}

export function getRightmoveBulkRunUrl(jobId: string): string | null {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) return null;
  return `${base}/api/commercial/rightmove-bulk/${jobId}/run`;
}

export async function kickRightmoveBulkWorker(jobId: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  const url = getRightmoveBulkRunUrl(jobId);
  if (!secret || !url) return false;

  try {
    void fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    }).catch((error) => {
      console.error('[rightmove-bulk] worker request failed', jobId, error);
    });
    return true;
  } catch (error) {
    console.error('[rightmove-bulk] worker kick failed', jobId, error);
    return false;
  }
}

/**
 * Continue a job after the start response: detached /run worker when
 * CRON_SECRET + site URL exist, plus Next.js `after()` as a same-isolate backup.
 */
export function scheduleRightmoveBulkContinuation(input: {
  jobId: string;
  processLocally: () => Promise<void>;
}): void {
  void kickRightmoveBulkWorker(input.jobId);

  const runLocal = async () => {
    try {
      await input.processLocally();
    } catch (error) {
      console.error(
        '[rightmove-bulk] local continuation failed',
        input.jobId,
        error,
      );
    }
  };

  void import('next/server')
    .then(({ after }) => {
      if (typeof after === 'function') {
        after(() => {
          void runLocal();
        });
        return;
      }
      void runLocal();
    })
    .catch(() => {
      void runLocal();
    });
}

export async function listStaleRightmoveBulkJobs(
  client: SupabaseClient,
  limit = 20,
): Promise<RightmoveBulkJob[]> {
  const staleBefore = new Date(Date.now() - STALE_HEARTBEAT_MS).toISOString();
  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .select('*')
    .in('status', ['queued', 'running'])
    .or(`locked_until.is.null,locked_until.lt."${new Date().toISOString()}"`)
    .lte('heartbeat_at', staleBefore)
    .order('heartbeat_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapJob);
}
