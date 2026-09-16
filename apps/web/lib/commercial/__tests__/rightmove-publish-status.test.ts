import { describe, expect, it } from 'vitest';

import { isRightmoveBulkJobStale } from '../rightmove-bulk-job-types';
import {
  type RightmoveDisposalStatusRow,
  collectRightmoveUrls,
  formatRightmovePublicationStatus,
  isRightmoveDisposalFailed,
  isRightmoveDisposalUnsynced,
  rightmoveDisposalIsOutOfSync,
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

describe('formatRightmovePublicationStatus', () => {
  it('labels stored portal statuses', () => {
    expect(formatRightmovePublicationStatus('published')).toBe('Published');
    expect(formatRightmovePublicationStatus(null)).toBe('Not pushed');
    expect(formatRightmovePublicationStatus('error')).toBe('Failed');
  });

  it('labels published-but-stale rows as Live but Unsynced', () => {
    expect(
      formatRightmovePublicationStatus('published', { outOfSync: true }),
    ).toBe('Live but Unsynced');
  });
});

describe('rightmovePublicationStatusBadgeClass', () => {
  it('uses distinct tones for published, not pushed, and failed', () => {
    const published = rightmovePublicationStatusBadgeClass('published');
    const notPushed = rightmovePublicationStatusBadgeClass(null);
    const failed = rightmovePublicationStatusBadgeClass('error');

    expect(published).toMatch(/emerald/);
    expect(notPushed).toMatch(/amber/);
    expect(failed).toMatch(/rose/);
    expect(published).not.toBe(notPushed);
    expect(notPushed).not.toBe(failed);
  });

  it('uses amber for live but unsynced', () => {
    const unsynced = rightmovePublicationStatusBadgeClass('published', {
      outOfSync: true,
    });
    expect(unsynced).toMatch(/amber/);
    expect(unsynced).not.toBe(
      rightmovePublicationStatusBadgeClass('published'),
    );
  });
});

function statusRow(
  partial: Partial<RightmoveDisposalStatusRow> & { name: string },
): RightmoveDisposalStatusRow {
  return {
    listingId: partial.listingId ?? partial.name,
    name: partial.name,
    listingStatus: partial.listingStatus ?? 'marketing',
    rightmoveStatus: partial.rightmoveStatus ?? 'none',
    externalId: partial.externalId ?? null,
    urls: partial.urls ?? [],
    lastUpdatedAt: partial.lastUpdatedAt ?? null,
    lastError: partial.lastError ?? null,
    outOfSync: partial.outOfSync ?? false,
  };
}

describe('rightmoveDisposalIsOutOfSync', () => {
  it('matches Live but Unsynced when last push is older than the listing', () => {
    expect(
      rightmoveDisposalIsOutOfSync({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        externalUrl: 'https://www.rightmove.co.uk/properties/123',
      }),
    ).toBe(true);
  });

  it('matches Live but Unsynced when last push is older than new media', () => {
    expect(
      rightmoveDisposalIsOutOfSync({
        listingStatus: 'marketing',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        mediaCreatedAt: ['2026-09-15T10:00:00.000Z'],
      }),
    ).toBe(true);
  });

  it('is false for a current published listing', () => {
    expect(
      rightmoveDisposalIsOutOfSync({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-15T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('is false when Rightmove is not live', () => {
    expect(
      rightmoveDisposalIsOutOfSync({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'none',
      }),
    ).toBe(false);
  });
});

describe('sortRightmoveDisposalRows', () => {
  it('puts failed then unsynced rows first, then removed, then the rest', () => {
    const sorted = sortRightmoveDisposalRows([
      statusRow({ name: 'Alpha', rightmoveStatus: 'published' }),
      statusRow({ name: 'Never pushed', rightmoveStatus: 'none' }),
      statusRow({ name: 'Delta House', rightmoveStatus: 'unpublished' }),
      statusRow({
        name: 'Camden Road',
        rightmoveStatus: 'published',
        outOfSync: true,
      }),
      statusRow({
        name: 'Unit 3C Pickhill',
        rightmoveStatus: 'error',
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
  it('reads the outOfSync flag used by the status overview', () => {
    expect(
      isRightmoveDisposalUnsynced(
        statusRow({
          name: 'Camden Road',
          rightmoveStatus: 'published',
          outOfSync: true,
        }),
      ),
    ).toBe(true);
    expect(
      isRightmoveDisposalUnsynced(
        statusRow({ name: 'Camden Road', rightmoveStatus: 'published' }),
      ),
    ).toBe(false);
    expect(
      isRightmoveDisposalFailed(
        statusRow({ name: 'Camden Road', rightmoveStatus: 'published' }),
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
