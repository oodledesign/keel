import { describe, expect, it } from 'vitest';

import {
  type ContentPost,
  addDays,
  addMonths,
  columnIndexFor,
  columnPosition,
  daysInMonth,
  groupPostsByDate,
  monthGrid,
  phaseBar,
  roadmapColumns,
  roadmapRange,
  weekStart,
} from './content-calendar';

const post = (id: string, postDate: string, postTime: string | null) =>
  ({
    id,
    postDate,
    postTime,
    title: id,
    body: '',
    status: 'idea',
    platforms: [],
    linkUrl: null,
  }) satisfies ContentPost;

describe('date helpers', () => {
  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
  });

  it('adds days and months without drifting', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(daysInMonth('2028-02-10')).toBe(29);
  });
});

describe('monthGrid', () => {
  it('returns Monday-first weeks that cover the whole month', () => {
    const weeks = monthGrid('2026-10-14');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]!.ymd).toBe('2026-09-28');
    expect(weeks[0]![0]!.inMonth).toBe(false);
    expect(weeks.flat().filter((day) => day.inMonth)).toHaveLength(31);
    expect(weeks.at(-1)!.at(-1)!.ymd >= '2026-10-31').toBe(true);
  });
});

describe('groupPostsByDate', () => {
  it('orders posts within a day by time, untimed last', () => {
    const grouped = groupPostsByDate([
      post('late', '2026-10-05', '17:00'),
      post('none', '2026-10-05', null),
      post('early', '2026-10-05', '08:00'),
    ]);
    expect(grouped.get('2026-10-05')!.map((entry) => entry.id)).toEqual([
      'early',
      'late',
      'none',
    ]);
  });
});

describe('roadmap columns', () => {
  it('builds week columns from a Monday', () => {
    const columns = roadmapColumns('2026-10-07', '2026-10-25', 'weeks');
    expect(columns.map((column) => column.start)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(columnIndexFor(columns, '2026-10-13')).toBe(1);
    expect(columnIndexFor(columns, '2026-12-01')).toBe(-1);
  });

  it('builds month columns', () => {
    const columns = roadmapColumns('2026-10-07', '2026-12-02', 'months');
    expect(columns.map((column) => column.start)).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
  });

  it('positions dates as fractions of the range', () => {
    const columns = roadmapColumns('2026-10-05', '2026-10-25', 'weeks');
    expect(columnPosition(columns, '2026-10-05')).toBe(0);
    expect(columnPosition(columns, '2026-10-12')).toBe(1);
    expect(columnPosition(columns, '2026-01-01')).toBe(0);
    expect(columnPosition(columns, '2027-01-01')).toBe(columns.length);
  });

  it('draws a phase bar, defaulting to two weeks from its due date', () => {
    const columns = roadmapColumns('2026-10-05', '2026-11-22', 'weeks');
    const bar = phaseBar(columns, '2026-10-12', '2026-10-25')!;
    expect(bar.start).toBe(1);
    expect(bar.end).toBe(3);
    expect(phaseBar(columns, null, null)).toBeNull();
    const fallback = phaseBar(columns, null, '2026-10-25')!;
    expect(fallback.end - fallback.start).toBeGreaterThan(1.5);
  });
});

describe('roadmapRange', () => {
  it('widens to cover dated items but stays bounded', () => {
    const range = roadmapRange({
      today: '2026-10-05',
      dates: ['2026-08-01', '2027-03-01', null],
    });
    expect(range.from).toBe('2026-08-01');
    expect(range.to > '2027-03-01').toBe(true);

    const far = roadmapRange({ today: '2026-10-05', dates: ['1990-01-01'] });
    expect(far.from >= '2025-10-04').toBe(true);
  });
});
