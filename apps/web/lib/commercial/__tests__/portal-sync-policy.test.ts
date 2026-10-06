import { describe, expect, it } from 'vitest';

import {
  isLiveRightmovePublication,
  isRightmoveRemovalPending,
  isRightmoveSaleSideRetryDue,
  isRightmoveSyncStale,
  resolveRightmoveLiveSyncAction,
  rightmoveRemovalReasonForStatus,
  shouldUnpublishRightmoveForListingStatus,
} from '../portal-sync-policy';

describe('isLiveRightmovePublication', () => {
  it('is true only for published rows', () => {
    expect(isLiveRightmovePublication('published')).toBe(true);
    expect(isLiveRightmovePublication('unpublished')).toBe(false);
    expect(isLiveRightmovePublication('error')).toBe(false);
    expect(isLiveRightmovePublication('draft')).toBe(false);
    expect(isLiveRightmovePublication(null)).toBe(false);
  });
});

describe('shouldUnpublishRightmoveForListingStatus', () => {
  it('unpublishes any status that is not Marketing or Under offer', () => {
    expect(shouldUnpublishRightmoveForListingStatus('let')).toBe(true);
    expect(shouldUnpublishRightmoveForListingStatus('sold')).toBe(true);
    expect(shouldUnpublishRightmoveForListingStatus('withdrawn')).toBe(true);
    expect(shouldUnpublishRightmoveForListingStatus('draft')).toBe(true);
    expect(shouldUnpublishRightmoveForListingStatus('instructed')).toBe(true);
    expect(shouldUnpublishRightmoveForListingStatus('under_offer')).toBe(false);
    expect(shouldUnpublishRightmoveForListingStatus('marketing')).toBe(false);
  });
});

describe('resolveRightmoveLiveSyncAction', () => {
  it('skips listings that were never pushed', () => {
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: null,
        listingStatus: 'marketing',
      }),
    ).toBe('skip');
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: 'unpublished',
        listingStatus: 'marketing',
      }),
    ).toBe('skip');
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: 'draft',
        listingStatus: 'marketing',
      }),
    ).toBe('skip');
  });

  it('enqueues live Marketing / Under offer updates instead of an immediate PUT', () => {
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: 'published',
        listingStatus: 'marketing',
      }),
    ).toBe('enqueue');
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: 'published',
        listingStatus: 'under_offer',
      }),
    ).toBe('enqueue');
  });

  it('unpublishes immediately when a live listing leaves portal statuses', () => {
    expect(
      resolveRightmoveLiveSyncAction({
        publicationStatus: 'published',
        listingStatus: 'sold',
      }),
    ).toBe('unpublish');
  });
});

describe('isRightmoveSyncStale', () => {
  it('is stale when a live Rightmove sync is older than the listing', () => {
    expect(
      isRightmoveSyncStale({
        publicationStatus: 'published',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
      }),
    ).toBe(true);
  });

  it('is current when last sync is after the listing and media', () => {
    expect(
      isRightmoveSyncStale({
        publicationStatus: 'published',
        lastSyncAt: '2026-09-15T12:00:00.000Z',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
        mediaCreatedAt: ['2026-09-11T10:00:00.000Z'],
      }),
    ).toBe(false);
  });

  it('ignores unpublished Rightmove rows', () => {
    expect(
      isRightmoveSyncStale({
        publicationStatus: 'unpublished',
        lastSyncAt: '2026-09-07T11:47:00.000Z',
        listingUpdatedAt: '2026-09-15T11:28:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('rightmoveRemovalReasonForStatus', () => {
  it('tells Rightmove why the property came off', () => {
    expect(rightmoveRemovalReasonForStatus('let')).toBe('LET_BY_US');
    expect(rightmoveRemovalReasonForStatus('sold')).toBe('SOLD_BY_US');
    expect(rightmoveRemovalReasonForStatus('withdrawn')).toBe(
      'WITHDRAWN_FROM_MARKET',
    );
    expect(rightmoveRemovalReasonForStatus('draft')).toBe('REMOVED');
    expect(rightmoveRemovalReasonForStatus(undefined)).toBe('REMOVED');
  });
});

describe('isRightmoveRemovalPending', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3_600_000).toISOString();

  it('flags off-market listings still marked live', () => {
    for (const listingStatus of ['let', 'sold', 'withdrawn', 'draft']) {
      expect(
        isRightmoveRemovalPending(
          { listingStatus, publicationStatus: 'published' },
          now,
        ),
      ).toBe(true);
    }
  });

  it('leaves on-market listings and already-removed ones alone', () => {
    expect(
      isRightmoveRemovalPending(
        { listingStatus: 'marketing', publicationStatus: 'published' },
        now,
      ),
    ).toBe(false);
    expect(
      isRightmoveRemovalPending(
        { listingStatus: 'under_offer', publicationStatus: 'published' },
        now,
      ),
    ).toBe(false);
    expect(
      isRightmoveRemovalPending(
        { listingStatus: 'let', publicationStatus: 'unpublished' },
        now,
      ),
    ).toBe(false);
    expect(
      isRightmoveRemovalPending(
        { listingStatus: 'let', publicationStatus: null },
        now,
      ),
    ).toBe(false);
  });

  it('retries a failed removal after an hour, and gives up after three days', () => {
    const failed = {
      listingStatus: 'sold',
      publicationStatus: 'error',
      stage: 'delete_error',
    };
    expect(
      isRightmoveRemovalPending({ ...failed, updatedAt: hoursAgo(0.2) }, now),
    ).toBe(false);
    expect(
      isRightmoveRemovalPending({ ...failed, updatedAt: hoursAgo(2) }, now),
    ).toBe(true);
    expect(
      isRightmoveRemovalPending({ ...failed, updatedAt: hoursAgo(100) }, now),
    ).toBe(false);
  });

  it('does not retry errors that were not failed removals', () => {
    expect(
      isRightmoveRemovalPending(
        {
          listingStatus: 'let',
          publicationStatus: 'error',
          stage: 'validation',
          updatedAt: hoursAgo(2),
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('isRightmoveSaleSideRetryDue', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const base = {
    listingStatus: 'marketing',
    publicationStatus: 'error',
    stage: 'sale_side_error',
  };

  it('retries an on-market listing an hour after the failure', () => {
    expect(
      isRightmoveSaleSideRetryDue(
        { ...base, updatedAt: '2026-10-06T10:00:00Z' },
        now,
      ),
    ).toBe(true);
  });

  it('waits out the first hour and gives up after three days', () => {
    expect(
      isRightmoveSaleSideRetryDue(
        { ...base, updatedAt: '2026-10-06T11:30:00Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isRightmoveSaleSideRetryDue(
        { ...base, updatedAt: '2026-10-01T10:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('ignores off-market listings and other errors', () => {
    expect(
      isRightmoveSaleSideRetryDue(
        { ...base, listingStatus: 'let', updatedAt: '2026-10-06T10:00:00Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isRightmoveSaleSideRetryDue(
        { ...base, stage: 'put_error', updatedAt: '2026-10-06T10:00:00Z' },
        now,
      ),
    ).toBe(false);
  });
});
