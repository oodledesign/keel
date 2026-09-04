import { describe, expect, it } from 'vitest';

import {
  listingNeedsFeedExternalId,
  resolveListingFeedExternalId,
} from '../listing-feed-external-id';

describe('resolveListingFeedExternalId', () => {
  it('keeps an existing Kato / feed id', () => {
    expect(resolveListingFeedExternalId('277302', 'uuid-1')).toBe('277302');
  });

  it('falls back to the listing UUID when missing', () => {
    expect(resolveListingFeedExternalId(null, 'uuid-1')).toBe('uuid-1');
    expect(resolveListingFeedExternalId('  ', 'uuid-1')).toBe('uuid-1');
  });
});

describe('listingNeedsFeedExternalId', () => {
  it('is true only when blank', () => {
    expect(listingNeedsFeedExternalId(null)).toBe(true);
    expect(listingNeedsFeedExternalId('')).toBe(true);
    expect(listingNeedsFeedExternalId('277302')).toBe(false);
  });
});
