import { describe, expect, it } from 'vitest';

import {
  compareListingMediaOrder,
  sortListingMedia,
} from '../listing-media-order';

describe('sortListingMedia', () => {
  it('orders by sort_order, then created_at, then id', () => {
    const sorted = sortListingMedia([
      { id: 'c', sort_order: 1, created_at: '2026-01-03T00:00:00Z' },
      { id: 'b', sort_order: 1, created_at: '2026-01-02T00:00:00Z' },
      { id: 'a', sort_order: 0, created_at: '2026-01-10T00:00:00Z' },
      { id: 'd', sort_order: 1, created_at: '2026-01-02T00:00:00Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('treats null / missing sort_order as 0', () => {
    const sorted = sortListingMedia([
      { id: 'later', sort_order: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 'nullish', sort_order: null, created_at: '2026-01-02T00:00:00Z' },
      { id: 'missing', created_at: '2026-01-01T00:00:00Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      'missing',
      'nullish',
      'later',
    ]);
  });

  it('accepts camelCase client fields', () => {
    const sorted = sortListingMedia([
      { id: 'two', sortOrder: 2, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'one', sortOrder: 1, createdAt: '2026-01-01T00:00:00Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['one', 'two']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { id: 'b', sort_order: 1 },
      { id: 'a', sort_order: 0 },
    ];

    const sorted = sortListingMedia(input);

    expect(sorted.map((item) => item.id)).toEqual(['a', 'b']);
    expect(input.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('compareListingMediaOrder', () => {
  it('is a consistent comparator for equal keys', () => {
    const item = {
      id: 'same',
      sortOrder: 3,
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(compareListingMediaOrder(item, item)).toBe(0);
  });
});
