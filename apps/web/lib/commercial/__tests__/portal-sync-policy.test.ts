import { describe, expect, it } from 'vitest';

import {
  isLiveRightmovePublication,
  isRightmoveSyncStale,
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
