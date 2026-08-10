import { describe, expect, it } from 'vitest';

import {
  filterOnMarketListingsForPortalFeed,
  isEachFeedIncluded,
} from '../each-feed-inclusion';

describe('isEachFeedIncluded', () => {
  it('defaults to included when there is no EACH publication', () => {
    expect(isEachFeedIncluded([])).toBe(true);
    expect(
      isEachFeedIncluded([{ portal: 'rightmove', status: 'published' }]),
    ).toBe(true);
  });

  it('is excluded only when EACH status is unpublished', () => {
    expect(
      isEachFeedIncluded([{ portal: 'each', status: 'unpublished' }]),
    ).toBe(false);
    expect(isEachFeedIncluded([{ portal: 'each', status: 'published' }])).toBe(
      true,
    );
    expect(isEachFeedIncluded([{ portal: 'each', status: 'draft' }])).toBe(
      true,
    );
  });
});

describe('filterOnMarketListingsForPortalFeed', () => {
  const listings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('leaves Property Hive listings unfiltered', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'property_hive',
        listings,
        unpublishedEachListingIds: new Set(['a', 'b']),
      }),
    ).toEqual(listings);
  });

  it('excludes unpublished EACH listings only', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'each',
        listings,
        unpublishedEachListingIds: new Set(['b']),
      }),
    ).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});
