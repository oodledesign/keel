import type { RightmoveBulkJobStatus } from '~/lib/commercial/rightmove-bulk-job-types';
import {
  type RightmoveOverviewStatus,
  resolveRightmoveDisposalOverviewStatus,
} from '~/lib/commercial/rightmove-publish-status';

export type AdminRightmoveListingInput = {
  listingId: string;
  listingName: string;
  listingStatus: string;
  listingUpdatedAt: string | null;
  accountId: string;
  accountName: string;
  accountSlug: string | null;
  rightmoveStatus: string;
  lastSyncAt: string | null;
  lastError: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  mediaCreatedAt?: Array<string | null | undefined>;
};

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

export type AdminRightmoveWorkspaceOption = {
  id: string;
  name: string;
  slug: string | null;
};

export function buildAdminRightmoveListingRow(
  input: AdminRightmoveListingInput,
): AdminRightmoveListingRow {
  const overviewStatus = resolveRightmoveDisposalOverviewStatus({
    listingStatus: input.listingStatus,
    listingUpdatedAt: input.listingUpdatedAt,
    rightmoveStatus: input.rightmoveStatus,
    lastSyncAt: input.lastSyncAt,
    lastError: input.lastError,
    externalId: input.externalId,
    externalUrl: input.externalUrl,
    mediaCreatedAt: input.mediaCreatedAt,
  });

  return {
    listingId: input.listingId,
    listingName: input.listingName.trim() || 'Untitled',
    listingStatus: input.listingStatus,
    listingUpdatedAt: input.listingUpdatedAt,
    accountId: input.accountId,
    accountName: input.accountName.trim() || 'Workspace',
    accountSlug: input.accountSlug,
    rightmoveStatus: input.rightmoveStatus,
    overviewStatus,
    pendingFlush: overviewStatus === 'unsynced',
    lastSyncAt: input.lastSyncAt,
    lastError: input.lastError,
    externalId: input.externalId ?? null,
  };
}

export function filterAdminRightmoveRows(
  rows: AdminRightmoveListingRow[],
  input: {
    overviewStatus?: RightmoveOverviewStatus | 'pending' | 'all';
    accountId?: string | null;
    query?: string | null;
  },
): AdminRightmoveListingRow[] {
  const filter = input.overviewStatus ?? 'all';
  const accountId = input.accountId?.trim() ?? '';
  const query = input.query?.trim().toLowerCase() ?? '';

  return rows.filter((row) => {
    if (accountId && row.accountId !== accountId) return false;
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
}

export function collectAdminRightmoveWorkspaces(
  rows: Array<
    Pick<AdminRightmoveListingRow, 'accountId' | 'accountName' | 'accountSlug'>
  >,
): AdminRightmoveWorkspaceOption[] {
  const byId = new Map<string, AdminRightmoveWorkspaceOption>();
  for (const row of rows) {
    if (byId.has(row.accountId)) continue;
    byId.set(row.accountId, {
      id: row.accountId,
      name: row.accountName,
      slug: row.accountSlug,
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en-GB'),
  );
}

export function formatRightmoveBulkJobStatus(status: RightmoveBulkJobStatus) {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}
