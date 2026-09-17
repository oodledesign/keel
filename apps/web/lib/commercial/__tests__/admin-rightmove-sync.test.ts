import { describe, expect, it } from 'vitest';

import {
  type AdminRightmoveListingInput,
  buildAdminRightmoveListingRow,
  collectAdminRightmoveWorkspaces,
  filterAdminRightmoveRows,
  formatRightmoveBulkJobStatus,
} from '../admin-rightmove-sync';

function row(overrides: Partial<AdminRightmoveListingInput> = {}) {
  return buildAdminRightmoveListingRow({
    listingId: 'listing-1',
    listingName: 'Camden warehouse',
    listingStatus: 'marketing',
    listingUpdatedAt: '2026-09-16T12:00:00.000Z',
    accountId: 'account-1',
    accountName: 'Bracketts',
    accountSlug: 'bracketts',
    rightmoveStatus: 'published',
    lastSyncAt: '2026-09-10T10:00:00.000Z',
    lastError: null,
    ...overrides,
  });
}

describe('buildAdminRightmoveListingRow', () => {
  it('marks live-but-behind listings as Unsynced and pending flush', () => {
    const built = row();
    expect(built.overviewStatus).toBe('unsynced');
    expect(built.pendingFlush).toBe(true);
  });

  it('marks listings with no Rightmove row as Not pushed', () => {
    const built = row({
      rightmoveStatus: 'none',
      lastSyncAt: null,
    });
    expect(built.overviewStatus).toBe('not_pushed');
    expect(built.pendingFlush).toBe(false);
  });

  it('keeps Failed when the stored publication errored', () => {
    const built = row({
      rightmoveStatus: 'error',
      lastError: 'Rightmove PUT failed (400)',
    });
    expect(built.overviewStatus).toBe('failed');
    expect(built.lastError).toMatch(/PUT failed/);
  });
});

describe('filterAdminRightmoveRows', () => {
  const rows = [
    row(),
    row({
      listingId: 'listing-2',
      listingName: 'Tunbridge Wells',
      accountId: 'account-2',
      accountName: 'Oodle',
      accountSlug: 'oodle',
      lastSyncAt: '2026-09-16T13:00:00.000Z',
    }),
  ];

  it('filters by workspace and search query', () => {
    expect(
      filterAdminRightmoveRows(rows, { accountId: 'account-2' }).map(
        (item) => item.listingName,
      ),
    ).toEqual(['Tunbridge Wells']);
    expect(
      filterAdminRightmoveRows(rows, { query: 'bracket' }).map(
        (item) => item.accountName,
      ),
    ).toEqual(['Bracketts']);
  });

  it('filters pending flush separately from all Unsynced labels', () => {
    expect(
      filterAdminRightmoveRows(rows, { overviewStatus: 'pending' }),
    ).toHaveLength(1);
  });
});

describe('collectAdminRightmoveWorkspaces', () => {
  it('dedupes and sorts workspace names', () => {
    const workspaces = collectAdminRightmoveWorkspaces([
      row({ accountId: 'b', accountName: 'Zebra' }),
      row({ accountId: 'a', accountName: 'Alpha' }),
      row({ accountId: 'a', accountName: 'Alpha' }),
    ]);
    expect(workspaces.map((item) => item.name)).toEqual(['Alpha', 'Zebra']);
  });
});

describe('formatRightmoveBulkJobStatus', () => {
  it('uses British English labels', () => {
    expect(formatRightmoveBulkJobStatus('queued')).toBe('Queued');
    expect(formatRightmoveBulkJobStatus('cancelled')).toBe('Cancelled');
  });
});
