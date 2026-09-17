import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { parseRightmoveBulkScope } from '~/lib/commercial/rightmove-bulk-eligibility';
import {
  type RightmoveBulkJobPublic,
  toPublicRightmoveBulkJob,
} from '~/lib/commercial/rightmove-bulk-job';
import { listRecentRightmoveFlushRuns } from '~/lib/commercial/rightmove-flush-job';
import type { RightmoveFlushRun } from '~/lib/commercial/rightmove-flush-job-types';
import {
  type RightmoveOverviewStatus,
  resolveRightmoveDisposalOverviewStatus,
} from '~/lib/commercial/rightmove-publish-status';

export type AdminRightmoveListingRow = {
  listingId: string;
  listingName: string;
  listingStatus: string;
  listingUpdatedAt: string | null;
  accountId: string;
  accountName: string;
  accountSlug: string | null;
  rightmoveStatus: string;
  overviewStatus: RightmoveOverviewStatus;
  pendingFlush: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  externalId: string | null;
};

export type AdminRightmoveSyncData = {
  listings: AdminRightmoveListingRow[];
  total: number;
  statusCounts: Record<RightmoveOverviewStatus, number>;
  jobs: RightmoveBulkJobPublic[];
  flushRuns: RightmoveFlushRun[];
};

function mapJob(row: Record<string, unknown>) {
  return toPublicRightmoveBulkJob({
    id: String(row.id),
    accountId: String(row.account_id),
    status: row.status as RightmoveBulkJobPublic['status'],
    scope: parseRightmoveBulkScope(
      typeof row.scope === 'string' ? row.scope : null,
    ),
    listingIds: Array.isArray(row.listing_ids)
      ? row.listing_ids.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    cursor: Number(row.cursor ?? 0),
    total: Number(row.total ?? 0),
    succeeded: Number(row.succeeded ?? 0),
    failed: Number(row.failed ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    lastListingId: (row.last_listing_id as string | null) ?? null,
    lastListingName: (row.last_listing_name as string | null) ?? null,
    failureNames: Array.isArray(row.failure_names)
      ? row.failure_names.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    startedAt: String(row.started_at),
    heartbeatAt: String(row.heartbeat_at),
    lockedUntil: (row.locked_until as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  });
}

async function loadAdminRightmoveSyncImpl(input: {
  overviewStatus?: RightmoveOverviewStatus | 'pending' | 'all';
  query?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<AdminRightmoveSyncData> {
  await requireSuperAdmin();
  const admin = getSupabaseServerAdminClient();
  const untypedAdmin = admin as unknown as SupabaseClient;
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 40));

  const [
    { data: pubs, error: pubsError },
    { data: jobRows, error: jobsError },
    flushRuns,
  ] = await Promise.all([
    admin
      .from('commercial_portal_publications')
      .select(
        'listing_id, account_id, status, last_sync_at, last_error, external_id, external_url',
      )
      .eq('portal', 'rightmove')
      .order('last_sync_at', { ascending: false, nullsFirst: true })
      .limit(800),
    untypedAdmin
      .from('commercial_rightmove_bulk_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20),
    listRecentRightmoveFlushRuns(untypedAdmin, 5),
  ]);

  if (pubsError) throw new Error(pubsError.message);
  if (jobsError) throw new Error(jobsError.message);

  const publications = (pubs ?? []) as Array<Record<string, unknown>>;
  const listingIds = [
    ...new Set(publications.map((row) => String(row.listing_id))),
  ];
  const accountIds = [
    ...new Set(publications.map((row) => String(row.account_id))),
  ];

  const [{ data: listings }, { data: accounts }, { data: media }] =
    await Promise.all([
      listingIds.length > 0
        ? admin
            .from('commercial_listings')
            .select('id, name, status, updated_at, account_id')
            .in('id', listingIds)
        : Promise.resolve({ data: [] }),
      accountIds.length > 0
        ? admin.from('accounts').select('id, name, slug').in('id', accountIds)
        : Promise.resolve({ data: [] }),
      listingIds.length > 0
        ? admin
            .from('commercial_listing_media')
            .select('listing_id, created_at')
            .eq('is_private', false)
            .in('listing_id', listingIds)
        : Promise.resolve({ data: [] }),
    ]);

  const listingById = new Map(
    ((listings ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      row,
    ]),
  );
  const accountById = new Map(
    ((accounts ?? []) as Array<Record<string, unknown>>).map((row) => [
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

  const rows: AdminRightmoveListingRow[] = publications.map((pub) => {
    const listingId = String(pub.listing_id);
    const listing = listingById.get(listingId);
    const account = accountById.get(String(pub.account_id));
    const overviewStatus = resolveRightmoveDisposalOverviewStatus({
      listingStatus: String(listing?.status ?? ''),
      listingUpdatedAt: (listing?.updated_at as string | null) ?? null,
      rightmoveStatus: String(pub.status ?? ''),
      lastSyncAt: (pub.last_sync_at as string | null) ?? null,
      lastError: (pub.last_error as string | null) ?? null,
      externalId: (pub.external_id as string | null) ?? null,
      externalUrl: (pub.external_url as string | null) ?? null,
      mediaCreatedAt: mediaByListing.get(listingId) ?? [],
    });

    return {
      listingId,
      listingName:
        ((listing?.name as string | null) ?? '').trim() || 'Untitled',
      listingStatus: String(listing?.status ?? ''),
      listingUpdatedAt: (listing?.updated_at as string | null) ?? null,
      accountId: String(pub.account_id),
      accountName:
        ((account?.name as string | null) ?? '').trim() || 'Workspace',
      accountSlug: (account?.slug as string | null) ?? null,
      rightmoveStatus: String(pub.status ?? ''),
      overviewStatus,
      pendingFlush: overviewStatus === 'unsynced',
      lastSyncAt: (pub.last_sync_at as string | null) ?? null,
      lastError: (pub.last_error as string | null) ?? null,
      externalId: (pub.external_id as string | null) ?? null,
    };
  });

  const statusCounts = {
    failed: 0,
    unsynced: 0,
    removed: 0,
    draft: 0,
    not_pushed: 0,
    pushed: 0,
  } satisfies Record<RightmoveOverviewStatus, number>;
  for (const row of rows) {
    statusCounts[row.overviewStatus] += 1;
  }

  const query = input.query?.trim().toLowerCase() ?? '';
  const filter = input.overviewStatus ?? 'all';
  const filtered = rows.filter((row) => {
    if (filter === 'pending' && !row.pendingFlush) return false;
    if (
      filter !== 'all' &&
      filter !== 'pending' &&
      row.overviewStatus !== filter
    ) {
      return false;
    }
    if (!query) return true;
    return (
      row.listingName.toLowerCase().includes(query) ||
      row.accountName.toLowerCase().includes(query) ||
      (row.accountSlug ?? '').toLowerCase().includes(query)
    );
  });

  const from = (page - 1) * pageSize;
  return {
    listings: filtered.slice(from, from + pageSize),
    total: filtered.length,
    statusCounts,
    jobs: ((jobRows ?? []) as Array<Record<string, unknown>>).map(mapJob),
    flushRuns,
  };
}

export const loadAdminRightmoveSync = cache(loadAdminRightmoveSyncImpl);
