import { describe, expect, it } from 'vitest';

import {
  DURATION_WEIGHTED_COVERAGE,
  computeTaskProgress,
} from './compute-task-progress';

function task(
  id: string,
  status: string,
  extras: {
    parent_task_id?: string | null;
    duration_minutes?: number | null;
  } = {},
) {
  return { id, status, ...extras };
}

describe('DURATION_WEIGHTED_COVERAGE', () => {
  it('is 80%', () => {
    expect(DURATION_WEIGHTED_COVERAGE).toBe(0.8);
  });
});

describe('computeTaskProgress', () => {
  it('returns 0 count mode when there are no tasks', () => {
    expect(computeTaskProgress([])).toEqual({ progressPct: 0, mode: 'count' });
  });

  it('returns 0 count mode when every leaf is cancelled', () => {
    expect(
      computeTaskProgress([
        task('a', 'cancelled', { duration_minutes: 60 }),
        task('b', 'cancelled', { duration_minutes: 30 }),
      ]),
    ).toEqual({ progressPct: 0, mode: 'count' });
  });

  it('falls back to leaf counts when duration coverage is below 80%', () => {
    const result = computeTaskProgress([
      task('a', 'done', { duration_minutes: 120 }),
      task('b', 'todo', { duration_minutes: 30 }),
      task('c', 'todo'),
      task('d', 'todo'),
    ]);

    expect(result).toEqual({ progressPct: 25, mode: 'count' });
  });

  it('uses duration weights when coverage is exactly 80%', () => {
    const result = computeTaskProgress([
      task('a', 'done', { duration_minutes: 80 }),
      task('b', 'todo', { duration_minutes: 20 }),
      task('c', 'todo', { duration_minutes: 20 }),
      task('d', 'todo', { duration_minutes: 20 }),
      task('e', 'done'),
    ]);

    // Duration mode omits the leaf without duration: 80 / 140.
    expect(result).toEqual({ progressPct: 57, mode: 'duration' });
  });

  it('weights done duration over timed leaves only', () => {
    const result = computeTaskProgress([
      task('short-done', 'done', { duration_minutes: 30 }),
      task('long-open', 'todo', { duration_minutes: 90 }),
    ]);

    expect(result).toEqual({ progressPct: 25, mode: 'duration' });
  });

  it('ignores a parent when children exist and does not double-count duration', () => {
    const result = computeTaskProgress([
      task('parent', 'done', { duration_minutes: 240 }),
      task('c1', 'done', { parent_task_id: 'parent', duration_minutes: 60 }),
      task('c2', 'todo', { parent_task_id: 'parent', duration_minutes: 60 }),
    ]);

    expect(result).toEqual({ progressPct: 50, mode: 'duration' });
  });

  it('treats a parent with no children as a leaf', () => {
    const result = computeTaskProgress([
      task('solo-parent', 'done', { duration_minutes: 60 }),
      task('other', 'todo', { duration_minutes: 60 }),
    ]);

    expect(result).toEqual({ progressPct: 50, mode: 'duration' });
  });

  it('excludes cancelled leaves from coverage and both progress modes', () => {
    const duration = computeTaskProgress([
      task('done', 'done', { duration_minutes: 60 }),
      task('open', 'todo', { duration_minutes: 40 }),
      task('cancelled', 'cancelled', { duration_minutes: 200 }),
    ]);

    expect(duration).toEqual({ progressPct: 60, mode: 'duration' });

    const count = computeTaskProgress([
      task('done', 'done'),
      task('open', 'todo'),
      task('cancelled', 'cancelled'),
    ]);

    expect(count).toEqual({ progressPct: 50, mode: 'count' });
  });

  it('does not promote a parent to a leaf when its only children are cancelled', () => {
    const result = computeTaskProgress([
      task('parent', 'todo', { duration_minutes: 120 }),
      task('c1', 'cancelled', {
        parent_task_id: 'parent',
        duration_minutes: 60,
      }),
    ]);

    expect(result).toEqual({ progressPct: 0, mode: 'count' });
  });

  it('treats duration of 0 or non-finite values as missing', () => {
    const result = computeTaskProgress([
      task('a', 'done', { duration_minutes: 0 }),
      task('b', 'todo', { duration_minutes: Number.NaN }),
      task('c', 'done', { duration_minutes: 30 }),
    ]);

    // 1 of 3 active leaves has duration → count mode, 2/3 done.
    expect(result).toEqual({ progressPct: 67, mode: 'count' });
  });

  it('counts a child whose parent is outside the input set as a leaf', () => {
    const result = computeTaskProgress([
      task('child', 'done', {
        parent_task_id: 'missing-parent',
        duration_minutes: 45,
      }),
    ]);

    expect(result).toEqual({ progressPct: 100, mode: 'duration' });
  });
});
