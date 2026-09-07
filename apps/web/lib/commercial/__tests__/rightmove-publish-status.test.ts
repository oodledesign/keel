import { describe, expect, it } from 'vitest';

import { isRightmoveBulkJobStale } from '../rightmove-bulk-job-types';
import {
  type RightmoveDisposalStatusRow,
  collectRightmoveUrls,
  formatRightmovePublicationStatus,
  isRightmoveDisposalFailed,
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

  it('treats a missing lock on a fresh heartbeat as still running', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    expect(
      isRightmoveBulkJobStale(
        {
          status: 'running',
          heartbeatAt: '2026-09-07T11:59:50.000Z',
          lockedUntil: null,
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
  };
}

describe('sortRightmoveDisposalRows', () => {
  it('puts failed rows first so a 2-of-164 error is visible', () => {
    const sorted = sortRightmoveDisposalRows([
      statusRow({ name: 'Alpha', rightmoveStatus: 'published' }),
      statusRow({
        name: 'Unit 3C Pickhill Business Centre',
        rightmoveStatus: 'error',
        lastError: 'Missing office',
      }),
      statusRow({ name: 'Beta', rightmoveStatus: 'none' }),
    ]);
    expect(sorted.map((row) => row.name)).toEqual([
      'Unit 3C Pickhill Business Centre',
      'Beta',
      'Alpha',
    ]);
  });
});

describe('isRightmoveDisposalFailed', () => {
  it('treats stored last_error as a failure even if status is not error', () => {
    expect(
      isRightmoveDisposalFailed(
        statusRow({
          name: 'Units 14 & 15, Pickhill Business Centre',
          rightmoveStatus: 'published',
          lastError: 'Rightmove PUT failed (400)',
        }),
      ),
    ).toBe(true);
  });
});
