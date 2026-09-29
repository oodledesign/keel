import { describe, expect, it } from 'vitest';

import {
  applyVisibleReorder,
  compareInstructionOrder,
  compareRequirementOrder,
  nextEndPosition,
} from './wip-order';
import { nextSheetSort, sortSheetRows } from './wip-sheet-sort';

describe('compareInstructionOrder', () => {
  it('orders by ladder position and breaks ties by id', () => {
    const rows = [
      { id: 'c', stage: 'current', ladderPosition: 2, boardPosition: 2 },
      { id: 'b', stage: 'current', ladderPosition: 1, boardPosition: 1 },
      { id: 'a', stage: 'current', ladderPosition: 2, boardPosition: 2 },
    ];
    expect(rows.sort(compareInstructionOrder).map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('pins fallen-through rows last', () => {
    const rows = [
      { id: 'a', stage: 'fallen_through', ladderPosition: 1 },
      { id: 'b', stage: 'current', ladderPosition: 9 },
    ];
    expect(rows.sort(compareInstructionOrder).map((r) => r.id)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('compareRequirementOrder', () => {
  it('orders by position, then newest first, then id', () => {
    const rows = [
      { id: 'a', boardPosition: 2, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'b', boardPosition: 1, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'c', boardPosition: 2, createdAt: '2026-02-01T00:00:00Z' },
    ];
    expect(rows.sort(compareRequirementOrder).map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});

describe('nextEndPosition', () => {
  it('goes after the highest position', () => {
    expect(nextEndPosition([3, 1, null, undefined])).toBe(4);
    expect(nextEndPosition([])).toBe(1);
  });
});

describe('applyVisibleReorder', () => {
  it('swaps visible rows among their slots and leaves hidden rows alone', () => {
    // a, c, e are visible; b and d are hidden by a search.
    expect(
      applyVisibleReorder(['a', 'b', 'c', 'd', 'e'], ['e', 'a', 'c']),
    ).toEqual(['e', 'b', 'a', 'd', 'c']);
  });

  it('keeps everything in place when nothing moved', () => {
    expect(applyVisibleReorder(['a', 'b', 'c'], ['a', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('nextSheetSort', () => {
  it('cycles ascending, descending, off', () => {
    const asc = nextSheetSort(null, 'name');
    expect(asc).toEqual({ key: 'name', direction: 'asc' });
    const desc = nextSheetSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSheetSort(desc, 'name')).toBeNull();
  });

  it('starts ascending when switching column', () => {
    expect(nextSheetSort({ key: 'name', direction: 'desc' }, 'value')).toEqual({
      key: 'value',
      direction: 'asc',
    });
  });
});

describe('sortSheetRows', () => {
  const rows = [
    { id: '1', name: 'beta', value: 10 },
    { id: '2', name: '', value: 30 },
    { id: '3', name: 'Alpha', value: null as number | null },
    { id: '4', name: 'alpha 10', value: 20 },
    { id: '5', name: 'alpha 2', value: 20 },
  ];
  const byId = (a: { id: string }, b: { id: string }) =>
    a.id.localeCompare(b.id);

  it('sorts text naturally and ignores case', () => {
    const sorted = sortSheetRows(
      rows,
      { key: 'name', direction: 'asc' },
      (r) => r.name,
      byId,
    );
    expect(sorted.map((r) => r.id)).toEqual(['3', '5', '4', '1', '2']);
  });

  it('keeps blanks last in both directions', () => {
    const desc = sortSheetRows(
      rows,
      { key: 'name', direction: 'desc' },
      (r) => r.name,
      byId,
    );
    expect(desc.map((r) => r.id)).toEqual(['1', '4', '5', '3', '2']);
  });

  it('sorts numbers numerically with the fallback breaking ties', () => {
    const sorted = sortSheetRows(
      rows,
      { key: 'value', direction: 'asc' },
      (r) => r.value,
      byId,
    );
    expect(sorted.map((r) => r.id)).toEqual(['1', '4', '5', '2', '3']);
  });
});
