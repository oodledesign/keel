import { describe, expect, it } from 'vitest';

import {
  listingBecameLiveForCirculation,
  matchDigestFingerprint,
  shouldSkipSameDigest,
} from '../digest-fingerprint';

describe('matchDigestFingerprint', () => {
  it('is order-independent and unique by listing id', () => {
    expect(matchDigestFingerprint(['b', 'a', 'a'])).toBe('a,b');
    expect(matchDigestFingerprint(['a', 'b'])).toBe(
      matchDigestFingerprint(['b', 'a']),
    );
  });
});

describe('shouldSkipSameDigest', () => {
  const now = new Date('2026-08-29T10:00:00.000Z');

  it('skips when the same set was mailed recently', () => {
    expect(
      shouldSkipSameDigest({
        lastFingerprint: 'a,b',
        lastSentAt: '2026-08-28T10:00:00.000Z',
        nextFingerprint: 'a,b',
        now,
      }),
    ).toBe(true);
  });

  it('sends again when the matching set changed', () => {
    expect(
      shouldSkipSameDigest({
        lastFingerprint: 'a,b',
        lastSentAt: '2026-08-28T10:00:00.000Z',
        nextFingerprint: 'a,b,c',
        now,
      }),
    ).toBe(false);
  });

  it('sends again after the cooldown', () => {
    expect(
      shouldSkipSameDigest({
        lastFingerprint: 'a,b',
        lastSentAt: '2026-08-01T10:00:00.000Z',
        nextFingerprint: 'a,b',
        now,
      }),
    ).toBe(false);
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
