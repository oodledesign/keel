import { describe, expect, it } from 'vitest';

import {
  blockStatusLabel,
  formatDuration,
  groupBlocksByDay,
  parseActivityRange,
  resolveRangeStart,
  sumActiveDuration,
  type ActivityBlockListRow,
} from '~/lib/activity/activity-history';

function makeBlock(
  overrides: Partial<ActivityBlockListRow> & Pick<ActivityBlockListRow, 'id' | 'startedAt'>,
): ActivityBlockListRow {
  return {
    userId: 'user-1',
    userName: 'Dan',
    appName: 'Safari',
    bundleId: 'com.apple.Safari',
    domain: 'github.com',
    windowTitle: 'Pull requests',
    endedAt: overrides.startedAt.replace('T10:', 'T10:05:'),
    durationSeconds: 300,
    projectId: null,
    projectName: null,
    clientId: null,
    clientName: null,
    confidenceScore: null,
    isConfirmed: false,
    isExcluded: false,
    ...overrides,
  };
}

describe('activity history helpers', () => {
  it('parses range keys with 7d default', () => {
    expect(parseActivityRange(null)).toBe('7d');
    expect(parseActivityRange('today')).toBe('today');
    expect(parseActivityRange('30d')).toBe('30d');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('groups blocks by day with Today label', () => {
    const now = new Date('2026-07-07T15:00:00.000Z');
    const groups = groupBlocksByDay(
      [
        makeBlock({
          id: 'a',
          startedAt: '2026-07-07T10:00:00.000Z',
        }),
        makeBlock({
          id: 'b',
          startedAt: '2026-07-06T10:00:00.000Z',
        }),
      ],
      now,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe('Today');
    expect(groups[1]?.label).toBe('Yesterday');
  });

  it('derives block status labels', () => {
    expect(
      blockStatusLabel(
        makeBlock({ id: 'a', startedAt: '2026-07-07T10:00:00.000Z', isExcluded: true }),
      ),
    ).toBe('excluded');
    expect(
      blockStatusLabel(
        makeBlock({ id: 'b', startedAt: '2026-07-07T10:00:00.000Z', isConfirmed: true }),
      ),
    ).toBe('confirmed');
    expect(
      blockStatusLabel(
        makeBlock({
          id: 'c',
          startedAt: '2026-07-07T10:00:00.000Z',
          projectId: 'project-1',
        }),
      ),
    ).toBe('suggested');
  });

  it('sums active duration excluding excluded blocks', () => {
    expect(
      sumActiveDuration([
        makeBlock({ id: 'a', startedAt: '2026-07-07T10:00:00.000Z', durationSeconds: 100 }),
        makeBlock({
          id: 'b',
          startedAt: '2026-07-07T11:00:00.000Z',
          durationSeconds: 200,
          isExcluded: true,
        }),
      ]),
    ).toBe(100);
  });

  it('resolves range start dates', () => {
    const now = new Date('2026-07-07T15:30:00.000Z');
    const todayStart = resolveRangeStart('today', now);
    expect(todayStart.getHours()).toBe(0);
    expect(todayStart.getMinutes()).toBe(0);
    expect(todayStart.getDate()).toBe(now.getDate());
    expect(resolveRangeStart('7d', now).getTime()).toBeLessThan(now.getTime());
  });
});
