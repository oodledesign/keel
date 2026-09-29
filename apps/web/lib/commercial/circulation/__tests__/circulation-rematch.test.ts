import { describe, expect, it } from 'vitest';

import {
  REMATCH_WINDOW_DAYS,
  activeListingChanges,
  isSentBeforeChange,
} from '../circulation-rematch';

const NOW = new Date('2026-10-10T12:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const BOTH_ON = { onPriceDrop: true, onRelist: true };
const BOTH_OFF = { onPriceDrop: false, onRelist: false };

describe('activeListingChanges', () => {
  const drop = (days: number) => ({
    kind: 'price_drop' as const,
    changedAt: daysAgo(days),
  });
  const relist = (days: number) => ({
    kind: 'relisted' as const,
    changedAt: daysAgo(days),
  });

  it('returns nothing when both toggles are off', () => {
    const active = activeListingChanges(
      [
        { listingId: 'a', changes: [drop(1)] },
        { listingId: 'b', changes: [relist(1)] },
      ],
      BOTH_OFF,
      NOW,
    );
    expect(active.size).toBe(0);
  });

  it('honours each toggle independently', () => {
    const listings = [
      { listingId: 'drop', changes: [drop(1)] },
      { listingId: 'relist', changes: [relist(1)] },
    ];

    expect([
      ...activeListingChanges(
        listings,
        { onPriceDrop: true, onRelist: false },
        NOW,
      ).keys(),
    ]).toEqual(['drop']);
    expect([
      ...activeListingChanges(
        listings,
        { onPriceDrop: false, onRelist: true },
        NOW,
      ).keys(),
    ]).toEqual(['relist']);
  });

  it('keeps both signals when a listing was relisted and dropped together', () => {
    const both = [
      {
        listingId: 'x',
        changes: [drop(2), relist(2)],
      },
    ];

    expect(
      activeListingChanges(
        both,
        { onPriceDrop: false, onRelist: true },
        NOW,
      ).get('x')?.kind,
    ).toBe('relisted');
    expect(
      activeListingChanges(
        both,
        { onPriceDrop: true, onRelist: false },
        NOW,
      ).get('x')?.kind,
    ).toBe('price_drop');
  });

  it('reports the later change when both toggles are on', () => {
    const active = activeListingChanges(
      [{ listingId: 'x', changes: [drop(6), relist(2)] }],
      BOTH_ON,
      NOW,
    );
    expect(active.get('x')?.kind).toBe('relisted');
  });

  it('ignores changes older than the window', () => {
    const active = activeListingChanges(
      [
        { listingId: 'fresh', changes: [drop(REMATCH_WINDOW_DAYS - 1)] },
        { listingId: 'stale', changes: [drop(REMATCH_WINDOW_DAYS + 1)] },
      ],
      BOTH_ON,
      NOW,
    );
    expect([...active.keys()]).toEqual(['fresh']);
  });

  it('skips listings with no changes and unparseable dates', () => {
    const active = activeListingChanges(
      [
        { listingId: 'none', changes: [] },
        {
          listingId: 'bad',
          changes: [{ kind: 'relisted', changedAt: 'not-a-date' }],
        },
      ],
      BOTH_ON,
      NOW,
    );
    expect(active.size).toBe(0);
  });
});

describe('isSentBeforeChange', () => {
  const change = { kind: 'price_drop' as const, changedAt: daysAgo(2) };

  it('is true when the contact was sent it before the change', () => {
    expect(isSentBeforeChange(daysAgo(5), change)).toBe(true);
  });

  it('is false once the contact was sent it after the change', () => {
    expect(isSentBeforeChange(daysAgo(1), change)).toBe(false);
  });

  it('is false with no active change', () => {
    expect(isSentBeforeChange(daysAgo(5), undefined)).toBe(false);
  });
});
