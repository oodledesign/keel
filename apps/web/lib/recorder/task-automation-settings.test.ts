import { describe, expect, it } from 'vitest';

import { findFreeSlotBeforeDueDate } from './task-automation-settings';

describe('findFreeSlotBeforeDueDate', () => {
  const scheduling = {
    workDays: [1, 2, 3, 4, 5],
    timezone: 'UTC',
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
  };

  it('finds the latest free slot before due date within working hours', () => {
    const slot = findFreeSlotBeforeDueDate({
      nowMs: Date.parse('2026-06-19T08:00:00Z'),
      dueDateYmd: '2026-06-19',
      leadTimeMinutes: 30,
      ...scheduling,
      busyIntervals: [
        {
          startMs: Date.parse('2026-06-19T14:00:00Z'),
          endMs: Date.parse('2026-06-19T16:00:00Z'),
        },
      ],
    });

    expect(slot).not.toBeNull();
    expect(slot?.end.getTime()).toBeLessThanOrEqual(
      Date.parse('2026-06-19T17:30:00Z'),
    );
  });

  it('skips non-working days when searching for a slot', () => {
    const slot = findFreeSlotBeforeDueDate({
      nowMs: Date.parse('2026-06-19T08:00:00Z'),
      dueDateYmd: '2026-06-22',
      leadTimeMinutes: 30,
      ...scheduling,
      busyIntervals: [],
    });

    expect(slot).not.toBeNull();
    expect(slot?.start.getUTCDay()).not.toBe(0);
    expect(slot?.start.getUTCDay()).not.toBe(6);
  });

  it('returns null when no slot exists before the due date deadline', () => {
    const slot = findFreeSlotBeforeDueDate({
      nowMs: Date.parse('2026-06-19T17:45:00Z'),
      dueDateYmd: '2026-06-19',
      leadTimeMinutes: 30,
      ...scheduling,
      busyIntervals: [
        {
          startMs: Date.parse('2026-06-19T09:00:00Z'),
          endMs: Date.parse('2026-06-19T17:30:00Z'),
        },
      ],
    });

    expect(slot).toBeNull();
  });
});
