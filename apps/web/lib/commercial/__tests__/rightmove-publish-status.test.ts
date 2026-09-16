import { describe, expect, it } from 'vitest';

import { isRightmoveBulkJobStale } from '../rightmove-bulk-job-types';
import {
  type RightmoveDisposalStatusRow,
  collectRightmoveUrls,
  countRightmoveOverviewStatuses,
  formatRightmoveOverviewStatus,
  formatRightmovePublicationStatus,
  isRightmoveDisposalFailed,
  isRightmoveDisposalUnsynced,
  resolveRightmoveDisposalOverviewStatus,
  resolveRightmoveOverviewStatus,
  rightmovePublicationStatusBadgeClass,
  sortRightmoveDisposalRows,
} from '../rightmove-publish-status';

describe('collectRightmoveUrls', () => {
  it('keeps a safe external URL and ignores junk', () => {
    expect(
      collectRightmoveUrls({
        externalUrl: 'https://www.rightmove.co.uk/properties/1',
        metadata: {
          displayUrl: 'javascript:alert(1)',
          links: { extra: 'https://www.adftest.rightmove.com/properties/1' },
        },
      }),
    ).toEqual([
      'https://www.rightmove.co.uk/properties/1',
      'https://www.adftest.rightmove.com/properties/1',
    ]);
  });

  it('dedupes the same URL from metadata', () => {
    expect(
      collectRightmoveUrls({
        externalUrl: 'https://www.rightmove.co.uk/properties/1',
        metadata: {
          displayUrl: 'https://www.rightmove.co.uk/properties/1',
        },
      }),
    ).toEqual(['https://www.rightmove.co.uk/properties/1']);
  });
});

describe('resolveRightmoveOverviewStatus', () => {
  it('treats Unsynced as a first-class status next to Pushed', () => {
    expect(
      resolveRightmoveOverviewStatus({
        storedStatus: 'published',
        outOfSync: true,
      }),
    ).toBe('unsynced');
    expect(
      resolveRightmoveOverviewStatus({
        storedStatus: 'published',
        outOfSync: false,
      }),
    ).toBe('pushed');
    expect(resolveRightmoveOverviewStatus({ storedStatus: 'unsynced' })).toBe(
      'unsynced',
    );
  });

  it('maps stored portal statuses into the same buckets', () => {
    expect(resolveRightmoveOverviewStatus({ storedStatus: 'error' })).toBe(
      'failed',
    );
    expect(
      resolveRightmoveOverviewStatus({ storedStatus: 'unpublished' }),
    ).toBe('removed');
    expect(resolveRightmoveOverviewStatus({ storedStatus: null })).toBe(
      'not_pushed',
    );
  });
});

describe('formatRightmovePublicationStatus', () => {
  it('labels stored portal statuses', () => {
    expect(formatRightmovePublicationStatus('published')).toBe('Pushed');
    expect(formatRightmovePublicationStatus('unsynced')).toBe('Unsynced');
    expect(formatRightmovePublicationStatus(null)).toBe('Not pushed');
    expect(formatRightmovePublicationStatus('error')).toBe('Failed');
  });
});

describe('formatRightmoveOverviewStatus', () => {
  it('uses the same short labels as the status chips', () => {
    expect(formatRightmoveOverviewStatus('pushed')).toBe('Pushed');
    expect(formatRightmoveOverviewStatus('unsynced')).toBe('Unsynced');
    expect(formatRightmoveOverviewStatus('failed')).toBe('Failed');
  });
});

describe('rightmovePublicationStatusBadgeClass', () => {
  it('uses distinct tones for pushed, not pushed, unsynced, and failed', () => {
    const pushed = rightmovePublicationStatusBadgeClass('published');
    const unsynced = rightmovePublicationStatusBadgeClass('unsynced');
    const notPushed = rightmovePublicationStatusBadgeClass(null);
    const failed = rightmovePublicationStatusBadgeClass('error');

    expect(pushed).toMatch(/emerald/);
    expect(unsynced).toMatch(/orange/);
    expect(notPushed).toMatch(/amber/);
    expect(failed).toMatch(/rose/);
    expect(pushed).not.toBe(unsynced);
    expect(unsynced).not.toBe(notPushed);
    expect(unsynced).not.toBe(failed);
  });
});

function statusRow(
  partial: Partial<RightmoveDisposalStatusRow> & { name: string },
): RightmoveDisposalStatusRow {
  const rightmoveStatus = partial.rightmoveStatus ?? 'none';
  return {
    listingId: partial.listingId ?? partial.name,
    name: partial.name,
    listingStatus: partial.listingStatus ?? 'marketing',
    rightmoveStatus,
    overviewStatus:
      partial.overviewStatus ??
      resolveRightmoveOverviewStatus({ storedStatus: rightmoveStatus }),
    externalId: partial.externalId ?? null,
    urls: partial.urls ?? [],
    lastUpdatedAt: partial.lastUpdatedAt ?? null,
    lastError: partial.lastError ?? null,
  };
}

describe('resolveRightmoveDisposalOverviewStatus', () => {
  it('is Unsynced when last push is older than the listing', () => {
    expect(
      resolveRightmoveDisposalOverviewStatus({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        externalUrl: 'https://www.rightmove.co.uk/properties/123',
      }),
    ).toBe('unsynced');
  });

  it('is Unsynced when last push is older than new media', () => {
    expect(
      resolveRightmoveDisposalOverviewStatus({
        listingStatus: 'marketing',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        mediaCreatedAt: ['2026-09-15T10:00:00.000Z'],
      }),
    ).toBe('unsynced');
  });

  it('is Pushed when last sync is current', () => {
    expect(
      resolveRightmoveDisposalOverviewStatus({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-15T12:00:00.000Z',
      }),
    ).toBe('pushed');
  });

  it('is Not pushed when Rightmove is not live', () => {
    expect(
      resolveRightmoveDisposalOverviewStatus({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'none',
      }),
    ).toBe('not_pushed');
  });
});

describe('countRightmoveOverviewStatuses', () => {
  it('counts Unsynced in its own bucket, not inside Pushed', () => {
    const counts = countRightmoveOverviewStatuses([
      statusRow({ name: 'Alpha', overviewStatus: 'pushed' }),
      statusRow({ name: 'Camden', overviewStatus: 'unsynced' }),
      statusRow({ name: 'Pickhill', overviewStatus: 'failed' }),
    ]);
    expect(counts.pushed).toBe(1);
    expect(counts.unsynced).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.not_pushed).toBe(0);
  });
});

describe('sortRightmoveDisposalRows', () => {
  it('sorts by first-class status: failed, unsynced, then the rest', () => {
    const sorted = sortRightmoveDisposalRows([
      statusRow({ name: 'Alpha', overviewStatus: 'pushed' }),
      statusRow({ name: 'Never pushed', overviewStatus: 'not_pushed' }),
      statusRow({ name: 'Delta House', overviewStatus: 'removed' }),
      statusRow({ name: 'Camden Road', overviewStatus: 'unsynced' }),
      statusRow({
        name: 'Unit 3C Pickhill',
        overviewStatus: 'failed',
        lastError: 'Missing office',
      }),
    ]);
    expect(sorted.map((row) => row.name)).toEqual([
      'Unit 3C Pickhill',
      'Camden Road',
      'Delta House',
      'Never pushed',
      'Alpha',
    ]);
  });
});

describe('isRightmoveDisposalUnsynced', () => {
  it('matches the Unsynced overview status', () => {
    expect(
      isRightmoveDisposalUnsynced(
        statusRow({ name: 'Camden Road', overviewStatus: 'unsynced' }),
      ),
    ).toBe(true);
    expect(
      isRightmoveDisposalUnsynced(
        statusRow({ name: 'Camden Road', overviewStatus: 'pushed' }),
      ),
    ).toBe(false);
    expect(
      isRightmoveDisposalFailed(
        statusRow({ name: 'Camden Road', overviewStatus: 'pushed' }),
      ),
    ).toBe(false);
  });
});

describe('isRightmoveBulkJobStale', () => {
  it('treats a recent running heartbeat as fresh', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    expect(
      isRightmoveBulkJobStale(
        {
          status: 'running',
          heartbeatAt: '2026-09-07T11:59:30.000Z',
          lockedUntil: '2026-09-07T12:01:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('treats an old heartbeat as stale so the page can resume', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    expect(
      isRightmoveBulkJobStale(
        {
          status: 'running',
          heartbeatAt: '2026-09-07T11:58:00.000Z',
          lockedUntil: '2026-09-07T11:59:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });
});
