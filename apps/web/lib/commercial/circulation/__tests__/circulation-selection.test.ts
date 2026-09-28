import { describe, expect, it } from 'vitest';

import {
  hasUnsentListing,
  isWithinMinGap,
  orderByLeastRecentlyCirculated,
  pickListingsForEmail,
} from '../circulation-selection';

function listing(listingId: string, score: number, autoCirculate = true) {
  return { listingId, score, autoCirculate };
}

describe('hasUnsentListing', () => {
  it('is false when every match has been shown', () => {
    expect(
      hasUnsentListing(
        [listing('a', 90), listing('b', 50)],
        new Set(['a', 'b']),
      ),
    ).toBe(false);
  });

  it('is true when at least one match is new', () => {
    expect(
      hasUnsentListing([listing('a', 90), listing('b', 50)], new Set(['a'])),
    ).toBe(true);
  });

  it('ignores new non-auto listings when auto-circulate is required', () => {
    expect(
      hasUnsentListing(
        [listing('a', 90), listing('b', 50, false)],
        new Set(['a']),
        { requireAutoCirculate: true },
      ),
    ).toBe(false);
  });
});

describe('pickListingsForEmail', () => {
  it('returns nothing when there is nothing new', () => {
    expect(
      pickListingsForEmail([listing('a', 90)], new Set(['a']), 12),
    ).toEqual([]);
  });

  it('fills slots with unsent listings first, then tops up by score', () => {
    const picked = pickListingsForEmail(
      [
        listing('sent-high', 95),
        listing('new-low', 45),
        listing('new-mid', 70),
      ],
      new Set(['sent-high']),
      12,
    );
    expect(picked.map((l) => l.listingId)).toEqual([
      'new-mid',
      'new-low',
      'sent-high',
    ]);
  });

  it('caps at max and keeps unsent listings ahead of sent ones', () => {
    const picked = pickListingsForEmail(
      [listing('s1', 99), listing('n1', 50), listing('n2', 60)],
      new Set(['s1']),
      2,
    );
    expect(picked.map((l) => l.listingId)).toEqual(['n2', 'n1']);
  });

  it('leads with the priority listing when it is unsent', () => {
    const picked = pickListingsForEmail(
      [listing('n1', 90), listing('trigger', 41)],
      new Set(),
      12,
      'trigger',
    );
    expect(picked[0]?.listingId).toBe('trigger');
  });
});

describe('isWithinMinGap', () => {
  const now = new Date('2026-09-28T10:00:00.000Z');

  it('holds back a contact emailed inside the gap', () => {
    expect(isWithinMinGap('2026-09-25T10:00:00.000Z', 5, now)).toBe(true);
  });

  it('allows a contact once the gap has elapsed', () => {
    expect(isWithinMinGap('2026-09-22T10:00:00.000Z', 5, now)).toBe(false);
  });

  it('never holds back contacts who have not been emailed, or a zero gap', () => {
    expect(isWithinMinGap(null, 5, now)).toBe(false);
    expect(isWithinMinGap('2026-09-28T09:00:00.000Z', 0, now)).toBe(false);
  });
});

describe('orderByLeastRecentlyCirculated', () => {
  it('puts never-emailed contacts first, then oldest last email', () => {
    const ordered = orderByLeastRecentlyCirculated([
      { email: 'recent@x.com', lastCirculatedAt: '2026-09-20T00:00:00.000Z' },
      { email: 'zed@x.com', lastCirculatedAt: null },
      { email: 'old@x.com', lastCirculatedAt: '2026-08-01T00:00:00.000Z' },
      { email: 'amy@x.com', lastCirculatedAt: null },
    ]);
    expect(ordered.map((row) => row.email)).toEqual([
      'amy@x.com',
      'zed@x.com',
      'old@x.com',
      'recent@x.com',
    ]);
  });
});
