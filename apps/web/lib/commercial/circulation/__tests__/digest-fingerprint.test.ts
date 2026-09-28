import { describe, expect, it } from 'vitest';

import {
  listingBecameLiveForCirculation,
  matchDigestFingerprint,
} from '../digest-fingerprint';

describe('matchDigestFingerprint', () => {
  it('is order-independent and unique by listing id', () => {
    expect(matchDigestFingerprint(['b', 'a', 'a'])).toBe('a,b');
    expect(matchDigestFingerprint(['a', 'b'])).toBe(
      matchDigestFingerprint(['b', 'a']),
    );
  });
});

describe('listingBecameLiveForCirculation', () => {
  it('fires when a draft goes to marketing', () => {
    expect(listingBecameLiveForCirculation('draft', 'marketing')).toBe(true);
  });

  it('does not re-fire between live statuses', () => {
    expect(listingBecameLiveForCirculation('instructed', 'marketing')).toBe(
      false,
    );
  });

  it('does not fire when leaving the market', () => {
    expect(listingBecameLiveForCirculation('marketing', 'withdrawn')).toBe(
      false,
    );
  });
});
