import { describe, expect, it } from 'vitest';

import {
  feedListSyncBadgeClass,
  feedListSyncTitle,
  formatEachListSyncStatus,
  formatWebsiteListSyncStatus,
  resolveEachListSyncStatus,
  resolveWebsiteListSyncStatus,
} from '../listing-feed-list-status';

const onMarketListing = {
  status: 'marketing',
  externalId: '14e1a5eb',
  websiteUrl: 'https://www.example.com/property/camden-road/',
  sizeMinSqft: 1200,
  name: '132-134 Camden Road',
  postcode: 'TN1 2QZ',
  disposalType: 'investment',
};

describe('resolveWebsiteListSyncStatus', () => {
  it('is live when on-market, included, and the feed id is present', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: onMarketListing,
        publications: [{ portal: 'property_hive', status: 'published' }],
      }),
    ).toBe('live');
    expect(formatWebsiteListSyncStatus('live')).toBe('Live');
  });

  it('treats a missing publication row as included (opt-out)', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: onMarketListing,
        publications: [],
      }),
    ).toBe('live');
  });

  it('is off when the website toggle is unpublished', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: onMarketListing,
        publications: [{ portal: 'property_hive', status: 'unpublished' }],
      }),
    ).toBe('off');
  });

  it('is blocked when included but the listing is not on-market', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: { ...onMarketListing, status: 'draft' },
        publications: [{ portal: 'property_hive', status: 'published' }],
      }),
    ).toBe('blocked');
  });

  it('is blocked when on-market but the website feed id is missing', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: { ...onMarketListing, externalId: null },
        publications: [{ portal: 'property_hive', status: 'published' }],
      }),
    ).toBe('blocked');
  });

  it('is error when Property Hive recorded an error', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: onMarketListing,
        publications: [
          {
            portal: 'property_hive',
            status: 'error',
            lastError: 'Property Hive rejected the feed row',
          },
        ],
      }),
    ).toBe('error');
    expect(formatWebsiteListSyncStatus('error')).toBe('Error');
    expect(feedListSyncBadgeClass('website', 'error')).toMatch(/rose/);
  });

  it('ignores stale credentials-not-configured errors for the XML feed', () => {
    expect(
      resolveWebsiteListSyncStatus({
        listing: onMarketListing,
        publications: [
          {
            portal: 'property_hive',
            status: 'error',
            lastError: 'Property Hive credentials not configured',
          },
        ],
      }),
    ).toBe('live');
  });
});

describe('resolveEachListSyncStatus', () => {
  it('is included when on-market and not unpublished', () => {
    expect(
      resolveEachListSyncStatus({
        listing: onMarketListing,
        publications: [{ portal: 'each', status: 'published' }],
      }),
    ).toBe('live');
    expect(formatEachListSyncStatus('live')).toBe('Included');
  });

  it('treats a missing EACH row as included (opt-out)', () => {
    expect(
      resolveEachListSyncStatus({
        listing: onMarketListing,
        publications: [],
      }),
    ).toBe('live');
  });

  it('is off when EACH is unpublished', () => {
    expect(
      resolveEachListSyncStatus({
        listing: onMarketListing,
        publications: [{ portal: 'each', status: 'unpublished' }],
      }),
    ).toBe('off');
  });

  it('is error when EACH recorded an error', () => {
    expect(
      resolveEachListSyncStatus({
        listing: onMarketListing,
        publications: [
          {
            portal: 'each',
            status: 'error',
            lastError: 'EACH rejected the listing',
          },
        ],
      }),
    ).toBe('error');
    expect(formatEachListSyncStatus('error')).toBe('Error');
    expect(feedListSyncTitle('each', 'error')).toMatch(/EACH: Error/);
  });

  it('is blocked when included but required EACH fields are missing', () => {
    expect(
      resolveEachListSyncStatus({
        listing: { ...onMarketListing, sizeMinSqft: null },
        publications: [{ portal: 'each', status: 'published' }],
      }),
    ).toBe('blocked');
  });
});
