import { describe, expect, it } from 'vitest';

import {
  allocateTasksIntoSlots,
  computeFreeSlots,
  parseClockToMinutes,
} from './allocate-task-slots';

describe('parseClockToMinutes', () => {
  it('parses 24-hour and 12-hour working hours', () => {
    expect(parseClockToMinutes('08:30')).toBe(8 * 60 + 30);
    expect(parseClockToMinutes('17:30')).toBe(17 * 60 + 30);
    expect(parseClockToMinutes('8:30am')).toBe(8 * 60 + 30);
    expect(parseClockToMinutes('5:30pm')).toBe(17 * 60 + 30);
  });
});

describe('computeFreeSlots', () => {
  it('returns the full day when nothing is busy', () => {
    expect(
      computeFreeSlots({
        dayStartMinutes: 9 * 60,
        dayEndMinutes: 12 * 60,
        busy: [],
      }),
    ).toEqual([{ startMinutes: 9 * 60, endMinutes: 12 * 60 }]);
  });

  it('punches calendar events out of the working day', () => {
    const slots = computeFreeSlots({
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 17 * 60,
      busy: [
        { startMinutes: 10 * 60, endMinutes: 11 * 60 },
        { startMinutes: 12 * 60, endMinutes: 13 * 60 },
      ],
    });

    expect(slots).toEqual([
      { startMinutes: 9 * 60, endMinutes: 10 * 60 },
      { startMinutes: 11 * 60, endMinutes: 12 * 60 },
      { startMinutes: 13 * 60, endMinutes: 17 * 60 },
    ]);
  });
});

describe('allocateTasksIntoSlots', () => {
  it('places a task using its full duration in one slot when it fits', () => {
    const { placements, unscheduled } = allocateTasksIntoSlots(
      [{ id: 'a', title: 'Write proposal', durationMinutes: 90 }],
      [{ startMinutes: 9 * 60, endMinutes: 17 * 60 }],
    );

    expect(unscheduled).toEqual([]);
    expect(placements).toEqual([
      {
        taskId: 'a',
        title: 'Write proposal',
        startMinutes: 9 * 60,
        endMinutes: 10 * 60 + 30,
        durationMinutes: 90,
        partIndex: 1,
        partCount: 1,
        groupKey: undefined,
        project: undefined,
      },
    ]);
  });

  it('splits a task across later gaps instead of overstuffing the first', () => {
    const { placements, unscheduled } = allocateTasksIntoSlots(
      [{ id: 'a', title: 'Deep work', durationMinutes: 90 }],
      [
        { startMinutes: 9 * 60, endMinutes: 9 * 60 + 45 },
        { startMinutes: 11 * 60, endMinutes: 12 * 60 },
        { startMinutes: 13 * 60, endMinutes: 13 * 60 + 40 },
      ],
    );

    expect(unscheduled).toEqual([]);
    expect(
      placements.map((part) => [part.title, part.durationMinutes]),
    ).toEqual([
      ['Deep work (1/2)', 45],
      ['Deep work (2/2)', 45],
    ]);
    expect(placements[0]?.endMinutes).toBe(9 * 60 + 45);
    expect(placements[1]?.startMinutes).toBe(11 * 60);
  });

  it('prefers a later contiguous slot over splitting when the whole task fits', () => {
    const { placements } = allocateTasksIntoSlots(
      [{ id: 'a', title: 'Workshop', durationMinutes: 90 }],
      [
        { startMinutes: 9 * 60, endMinutes: 9 * 60 + 30 },
        { startMinutes: 13 * 60, endMinutes: 17 * 60 },
      ],
    );

    expect(placements).toHaveLength(1);
    expect(placements[0]?.startMinutes).toBe(13 * 60);
    expect(placements[0]?.durationMinutes).toBe(90);
  });

  it('records leftover minutes instead of dropping or overstuffing', () => {
    const { placements, unscheduled } = allocateTasksIntoSlots(
      [{ id: 'a', title: 'Big task', durationMinutes: 180 }],
      [{ startMinutes: 16 * 60, endMinutes: 17 * 60 }],
    );

    expect(placements).toHaveLength(1);
    expect(placements[0]?.durationMinutes).toBe(60);
    expect(unscheduled).toEqual([
      {
        taskId: 'a',
        title: 'Big task',
        remainingMinutes: 120,
        reason: 'Not enough free time (120m left)',
        project: undefined,
      },
    ]);
  });

  it('does not overstuff a 30-minute gap with a 90-minute task', () => {
    const { placements, unscheduled } = allocateTasksIntoSlots(
      [{ id: 'a', title: 'Deep work', durationMinutes: 90 }],
      [{ startMinutes: 9 * 60, endMinutes: 9 * 60 + 30 }],
    );

    expect(placements[0]?.endMinutes).toBe(9 * 60 + 30);
    expect(placements[0]?.durationMinutes).toBe(30);
    expect(unscheduled[0]?.remainingMinutes).toBe(60);
  });
});
