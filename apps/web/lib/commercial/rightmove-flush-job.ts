import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  publishToRightmove,
  setPortalPublishersClient,
} from '~/lib/commercial/portal-publishers';
import { isRightmoveBulkListingEligible } from '~/lib/commercial/rightmove-bulk-eligibility';
import { loadActiveRightmoveBulkJob } from '~/lib/commercial/rightmove-bulk-job';
import type { RightmoveFlushRun } from '~/lib/commercial/rightmove-flush-job-types';

export type { RightmoveFlushRun } from '~/lib/commercial/rightmove-flush-job-types';

export type ProcessRightmoveFlushResult = {
  runId: string;
  processed: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
};

const DEFAULT_LIMIT = 20;
const DEFAULT_DELAY_MS = 300;
const LOOKAHEAD = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function mapRightmoveFlushRun(
  row: Record<string, unknown>,
): RightmoveFlushRun {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    completedAt: (row.completed_at as string | null) ?? null,
    processed: Number(row.processed ?? 0),
    succeeded: Number(row.succeeded ?? 0),
    failed: Number(row.failed ?? 0),
    lastError: (row.last_error as string | null) ?? null,
  };
}

async function listActiveBulkListingIds(
  client: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('commercial_rightmove_bulk_jobs')
    .select('listing_ids')
    .in('status', ['queued', 'running']);

  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    for (const listingId of asStringArray(row.listing_ids)) {
      ids.add(listingId);
    }
  }
  return ids;
}

export async function listRightmoveFlushCandidates(
  client: SupabaseClient,
  limit = DEFAULT_LIMIT,
): Promise<Array<{ accountId: string; listingId: string; name: string }>> {
  const busyIds = await listActiveBulkListingIds(client);
  const { data: pubs, error: pubsError } = await client
    .from('commercial_portal_publications')
    .select(
      'listing_id, account_id, status, last_sync_at, last_error, external_id, external_url',
    )
    .eq('portal', 'rightmove')
    .eq('status', 'published')
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(LOOKAHEAD);

  if (pubsError) throw new Error(pubsError.message);

  const publications = (pubs ?? []) as Array<Record<string, unknown>>;
  const listingIds = [
    ...new Set(publications.map((row) => String(row.listing_id))),
  ].filter((id) => !busyIds.has(id));

  if (listingIds.length === 0) return [];

  const [
    { data: listings, error: listingsError },
    { data: media, error: mediaError },
  ] = await Promise.all([
    client
      .from('commercial_listings')
      .select('id, account_id, name, status, updated_at')
      .in('id', listingIds),
    client
      .from('commercial_listing_media')
      .select('listing_id, created_at')
      .eq('is_private', false)
      .in('listing_id', listingIds),
  ]);

  if (listingsError) throw new Error(listingsError.message);
  if (mediaError) throw new Error(mediaError.message);

  const listingById = new Map(
    ((listings ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const mediaByListing = new Map<string, string[]>();
  for (const row of (media ?? []) as Array<Record<string, unknown>>) {
    const listingId = String(row.listing_id);
    const createdAt =
      typeof row.created_at === 'string' ? row.created_at : null;
    if (!createdAt) continue;
    const current = mediaByListing.get(listingId) ?? [];
    current.push(createdAt);
    mediaByListing.set(listingId, current);
  }

  const candidates: Array<{
    accountId: string;
    listingId: string;
    name: string;
  }> = [];

  for (const pub of publications) {
    const listingId = String(pub.listing_id);
    if (busyIds.has(listingId)) continue;
    const listing = listingById.get(listingId);
    if (!listing) continue;
    if (
      !isRightmoveBulkListingEligible(
        {
          listingStatus: String(listing.status ?? ''),
          listingUpdatedAt: (listing.updated_at as string | null) ?? null,
          rightmoveStatus: String(pub.status ?? ''),
          lastSyncAt: (pub.last_sync_at as string | null) ?? null,
          lastError: (pub.last_error as string | null) ?? null,
          externalId: (pub.external_id as string | null) ?? null,
          externalUrl: (pub.external_url as string | null) ?? null,
          mediaCreatedAt: mediaByListing.get(listingId) ?? [],
        },
        'unsynced',
      )
    ) {
      continue;
    }
    candidates.push({
      accountId: String(listing.account_id ?? pub.account_id),
      listingId,
      name: ((listing.name as string | null) ?? '').trim() || 'Untitled',
    });
    if (candidates.length >= limit) break;
  }

  return candidates;
}

export async function processRightmoveFlushBatch(input: {
  client: SupabaseClient;
  limit?: number;
  delayMs?: number;
}): Promise<ProcessRightmoveFlushResult> {
  const limit = Math.min(40, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const delayMs = Math.max(0, input.delayMs ?? DEFAULT_DELAY_MS);
  const now = new Date().toISOString();

  const { data: runRow, error: insertError } = await input.client
    .from('commercial_rightmove_flush_runs')
    .insert({
      started_at: now,
      processed: 0,
      succeeded: 0,
      failed: 0,
      created_at: now,
    })
    .select('*')
    .single();

  if (insertError || !runRow) {
    throw new Error(insertError?.message ?? 'Could not start Rightmove flush');
  }

  const runId = String((runRow as Record<string, unknown>).id);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let lastError: string | null = null;

  const candidates = await listRightmoveFlushCandidates(input.client, limit);
  setPortalPublishersClient(input.client);
  try {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const active = await loadActiveRightmoveBulkJob(
        input.client,
        candidate.accountId,
      );
      if (active) continue;

      processed += 1;
      try {
        let publication = await publishToRightmove(
          candidate.accountId,
          candidate.listingId,
        );
        if (
          publication.status === 'error' &&
          (publication.last_error ?? '').toLowerCase().includes('rate limit')
        ) {
          await sleep(5_000);
          publication = await publishToRightmove(
            candidate.accountId,
            candidate.listingId,
          );
        }

        if (publication.status === 'error') {
          failed += 1;
          lastError = publication.last_error ?? 'Rightmove publish failed';
        } else {
          succeeded += 1;
        }
      } catch (error) {
        failed += 1;
        lastError =
          error instanceof Error ? error.message : 'Rightmove publish failed';
      }

      if (i < candidates.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  } finally {
    setPortalPublishersClient(null);
  }

  const completedAt = new Date().toISOString();
  const { error: updateError } = await input.client
    .from('commercial_rightmove_flush_runs')
    .update({
      completed_at: completedAt,
      processed,
      succeeded,
      failed,
      last_error: lastError,
    })
    .eq('id', runId);

  if (updateError) {
    console.error('[rightmove-flush] persist run failed', updateError.message);
  }

  return { runId, processed, succeeded, failed, lastError };
}

export async function loadLatestRightmoveFlushRun(
  client: SupabaseClient,
): Promise<RightmoveFlushRun | null> {
  const { data, error } = await client
    .from('commercial_rightmove_flush_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRightmoveFlushRun(data as Record<string, unknown>) : null;
}

export async function listRecentRightmoveFlushRuns(
  client: SupabaseClient,
  limit = 5,
): Promise<RightmoveFlushRun[]> {
  const { data, error } = await client
    .from('commercial_rightmove_flush_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(
    mapRightmoveFlushRun,
  );
}
