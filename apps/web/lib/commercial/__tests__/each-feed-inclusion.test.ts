import { describe, expect, it } from 'vitest';

import {
  filterOnMarketListingsForPortalFeed,
  isEachFeedIncluded,
  isWebsiteFeedIncluded,
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

describe('isWebsiteFeedIncluded', () => {
  it('defaults to included when there is no Property Hive publication', () => {
    expect(isWebsiteFeedIncluded([])).toBe(true);
    expect(
      isWebsiteFeedIncluded([{ portal: 'each', status: 'unpublished' }]),
    ).toBe(true);
  });

  it('is excluded only when Property Hive status is unpublished', () => {
    expect(
      isWebsiteFeedIncluded([
        { portal: 'property_hive', status: 'unpublished' },
      ]),
    ).toBe(false);
    expect(
      isWebsiteFeedIncluded([{ portal: 'property_hive', status: 'published' }]),
    ).toBe(true);
    expect(
      isWebsiteFeedIncluded([{ portal: 'property_hive', status: 'draft' }]),
    ).toBe(true);
    expect(
      isWebsiteFeedIncluded([{ portal: 'property_hive', status: 'error' }]),
    ).toBe(true);
  });
});

describe('filterOnMarketListingsForPortalFeed', () => {
  const listings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('leaves Property Hive listings unfiltered when no website opt-outs are given', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'property_hive',
        listings,
        unpublishedEachListingIds: new Set(['a', 'b']),
      }),
    ).toEqual(listings);
  });

  it('excludes unpublished website listings from the Property Hive set', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'property_hive',
        listings,
        unpublishedEachListingIds: new Set(['a']),
        unpublishedWebsiteListingIds: new Set(['b']),
      }),
    ).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('does not treat EACH opt-outs as website opt-outs', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'property_hive',
        listings,
        unpublishedEachListingIds: new Set(['a', 'b']),
        unpublishedWebsiteListingIds: new Set(),
      }),
    ).toEqual(listings);
  });

  it('excludes unpublished EACH listings only', () => {
    expect(
      filterOnMarketListingsForPortalFeed({
        portal: 'each',
        listings,
        unpublishedEachListingIds: new Set(['b']),
        unpublishedWebsiteListingIds: new Set(['a', 'c']),
      }),
    ).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});
