import { describe, expect, it } from 'vitest';

import {
  LISTING_PORTAL_PUBLISH_STATUSES,
  listingStatusPublishHint,
  listingStatusPublishesToPortals,
} from '../commercial-constants';

describe('listingStatusPublishesToPortals', () => {
  it('allows marketing and under_offer only', () => {
    expect([...LISTING_PORTAL_PUBLISH_STATUSES]).toEqual([
      'marketing',
      'under_offer',
    ]);
    expect(listingStatusPublishesToPortals('marketing')).toBe(true);
    expect(listingStatusPublishesToPortals('under_offer')).toBe(true);
    for (const status of [
      'draft',
      'instructed',
      'let',
      'sold',
      'withdrawn',
    ]) {
      expect(listingStatusPublishesToPortals(status)).toBe(false);
    }
  });
});

describe('listingStatusPublishHint', () => {
  it('returns short portal publish copy', () => {
    expect(listingStatusPublishHint('marketing')).toBe(
      'Can publish to website',
    );
    expect(listingStatusPublishHint('under_offer')).toBe(
      'Can publish to website',
    );
    expect(listingStatusPublishHint('draft')).toBe('Won’t publish');
    expect(listingStatusPublishHint('sold')).toBe('Won’t publish');
  });
});
