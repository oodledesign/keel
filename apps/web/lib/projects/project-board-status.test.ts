import { describe, expect, it } from 'vitest';

import { applyItemStatus, mergePendingStatuses } from './project-board-status';

describe('applyItemStatus', () => {
  it('updates only the matching item and leaves others untouched', () => {
    const items = [
      { id: 'a', status: 'pending', title: 'Alpha' },
      { id: 'b', status: 'in_progress', title: 'Beta' },
    ];

    const next = applyItemStatus(items, 'a', 'on_hold');

    expect(next).toEqual([
      { id: 'a', status: 'on_hold', title: 'Alpha' },
      { id: 'b', status: 'in_progress', title: 'Beta' },
    ]);
    expect(next[1]).toBe(items[1]);
    expect(items[0]?.status).toBe('pending');
  });

  it('accepts custom workspace status slugs', () => {
    const items = [{ id: 'a', status: 'pending' }];
    expect(applyItemStatus(items, 'a', 'invoiced')[0]?.status).toBe('invoiced');
  });
});

describe('mergePendingStatuses', () => {
  it('keeps in-flight moves when the parent list is still stale', () => {
    const items = [
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'pending' },
    ];
    const pending = new Map([['a', 'completed']]);

    expect(mergePendingStatuses(items, pending)).toEqual([
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'pending' },
    ]);
  });

  it('returns the same array when nothing is pending', () => {
    const items = [{ id: 'a', status: 'pending' }];
    expect(mergePendingStatuses(items, new Map())).toBe(items);
  });

  it('applies a pending slug even when it is an empty string', () => {
    const items = [{ id: 'a', status: 'pending' }];
    expect(mergePendingStatuses(items, new Map([['a', '']]))).toEqual([
      { id: 'a', status: '' },
    ]);
  });
});
