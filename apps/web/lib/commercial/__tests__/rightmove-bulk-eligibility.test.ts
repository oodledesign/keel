import { describe, expect, it } from 'vitest';

import {
  isRightmoveBulkListingEligible,
  isRightmoveBulkRowEligible,
  isRightmoveFlushCandidate,
  parseRightmoveBulkScope,
  selectRightmoveBulkEligibleRows,
} from '../rightmove-bulk-eligibility';
import type { RightmoveOverviewStatus } from '../rightmove-publish-status';

function row(listingStatus: string, overviewStatus: RightmoveOverviewStatus) {
  return { listingStatus, overviewStatus };
}

describe('parseRightmoveBulkScope', () => {
  it('defaults unknown values to all', () => {
    expect(parseRightmoveBulkScope(undefined)).toBe('all');
    expect(parseRightmoveBulkScope('nope')).toBe('all');
    expect(parseRightmoveBulkScope('unsynced')).toBe('unsynced');
  });
});

describe('isRightmoveBulkRowEligible', () => {
  it('Push all includes Marketing / Under offer regardless of sync status', () => {
    expect(isRightmoveBulkRowEligible(row('marketing', 'not_pushed'))).toBe(
      true,
    );
    expect(isRightmoveBulkRowEligible(row('under_offer', 'pushed'))).toBe(true);
    expect(isRightmoveBulkRowEligible(row('marketing', 'unsynced'))).toBe(true);
    expect(isRightmoveBulkRowEligible(row('marketing', 'failed'))).toBe(true);
  });

  it('Push all skips listings that cannot publish to portals', () => {
    expect(isRightmoveBulkRowEligible(row('instructed', 'not_pushed'))).toBe(
      false,
    );
    expect(isRightmoveBulkRowEligible(row('sold', 'unsynced'))).toBe(false);
  });

  it('Resync includes only already-live listings that are Unsynced', () => {
    expect(
      isRightmoveBulkRowEligible(row('marketing', 'unsynced'), 'unsynced'),
    ).toBe(true);
    expect(
      isRightmoveBulkRowEligible(row('under_offer', 'unsynced'), 'unsynced'),
    ).toBe(true);
  });

  it('Resync skips Not pushed, in-sync Pushed, and Failed', () => {
    expect(
      isRightmoveBulkRowEligible(row('marketing', 'not_pushed'), 'unsynced'),
    ).toBe(false);
    expect(
      isRightmoveBulkRowEligible(row('marketing', 'pushed'), 'unsynced'),
    ).toBe(false);
    expect(
      isRightmoveBulkRowEligible(row('marketing', 'failed'), 'unsynced'),
    ).toBe(false);
    expect(
      isRightmoveBulkRowEligible(row('marketing', 'removed'), 'unsynced'),
    ).toBe(false);
  });
});

describe('isRightmoveBulkListingEligible', () => {
  const liveUnsynced = {
    listingStatus: 'marketing',
    listingUpdatedAt: '2026-09-15T11:28:00.000Z',
    rightmoveStatus: 'published',
    lastSyncAt: '2026-09-07T11:47:00.000Z',
    externalUrl: 'https://www.rightmove.co.uk/properties/123',
  };

  it('treats a live-but-behind listing as eligible only for resync', () => {
    expect(isRightmoveBulkListingEligible(liveUnsynced, 'all')).toBe(true);
    expect(isRightmoveBulkListingEligible(liveUnsynced, 'unsynced')).toBe(true);
  });

  it('does not first-time push Not pushed listings in the resync scope', () => {
    const neverPushed = {
      listingStatus: 'marketing',
      listingUpdatedAt: '2026-09-15T11:28:00.000Z',
      rightmoveStatus: 'none',
    };
    expect(isRightmoveBulkListingEligible(neverPushed, 'all')).toBe(true);
    expect(isRightmoveBulkListingEligible(neverPushed, 'unsynced')).toBe(false);
  });

  it('skips already in-sync live listings from resync', () => {
    const inSync = {
      listingStatus: 'marketing',
      listingUpdatedAt: '2026-09-15T11:28:00.000Z',
      rightmoveStatus: 'published',
      lastSyncAt: '2026-09-15T12:00:00.000Z',
    };
    expect(isRightmoveBulkListingEligible(inSync, 'all')).toBe(true);
    expect(isRightmoveBulkListingEligible(inSync, 'unsynced')).toBe(false);
  });
});

describe('isRightmoveFlushCandidate', () => {
  it('includes live Unsynced listings for the 15-minute cron', () => {
    expect(
      isRightmoveFlushCandidate({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
      }),
    ).toBe(true);
  });

  it('skips Not pushed, in-sync Pushed, and off-market listings', () => {
    expect(
      isRightmoveFlushCandidate({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'none',
      }),
    ).toBe(false);
    expect(
      isRightmoveFlushCandidate({
        listingStatus: 'marketing',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-15T12:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      isRightmoveFlushCandidate({
        listingStatus: 'sold',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        rightmoveStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('selectRightmoveBulkEligibleRows', () => {
  it('filters a mixed workspace to Unsynced Marketing rows only', () => {
    const selected = selectRightmoveBulkEligibleRows(
      [
        { name: 'Alpha', listingStatus: 'marketing', overviewStatus: 'pushed' },
        {
          name: 'Camden',
          listingStatus: 'marketing',
          overviewStatus: 'unsynced',
        },
        {
          name: 'Never',
          listingStatus: 'marketing',
          overviewStatus: 'not_pushed',
        },
        { name: 'Sold', listingStatus: 'sold', overviewStatus: 'unsynced' },
      ],
      'unsynced',
    );
    expect(selected.map((row) => row.name)).toEqual(['Camden']);
  });
});
