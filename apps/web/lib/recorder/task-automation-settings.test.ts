import { describe, expect, it } from 'vitest';

import { findFreeSlotBeforeDueDate } from './task-automation-settings';

describe('findFreeSlotBeforeDueDate', () => {
  const nowMs = Date.parse('2026-06-19T08:00:00');

  it('finds the latest free slot before due date within working hours', () => {
    const slot = findFreeSlotBeforeDueDate({
      nowMs,
      dueDateYmd: '2026-06-20',
      leadTimeMinutes: 30,
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      busyIntervals: [
        {
          startMs: Date.parse('2026-06-19T14:00:00'),
          endMs: Date.parse('2026-06-19T16:00:00'),
        },
      ],
    });

    expect(slot).not.toBeNull();
    expect(slot?.end.getTime()).toBeLessThanOrEqual(
      Date.parse('2026-06-20T17:30:00'),
    );
  });

  it('returns null when no slot exists before the due date deadline', () => {
    const slot = findFreeSlotBeforeDueDate({
      nowMs: Date.parse('2026-06-19T17:45:00'),
      dueDateYmd: '2026-06-19',
      leadTimeMinutes: 30,
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      busyIntervals: [
        {
          startMs: Date.parse('2026-06-19T09:00:00'),
          endMs: Date.parse('2026-06-19T17:30:00'),
        },
      ],
    });

    expect(slot).toBeNull();
  });
});
