import { describe, expect, it } from 'vitest';

import { slotConflictsWithBusy } from './slot-conflict';
import { WEEKDAY_WORKING_HOURS, suggestPollSlots } from './suggest-poll-slots';

describe('suggestPollSlots', () => {
  it('suggests weekday London hours and skips weekends', () => {
    const slots = suggestPollSlots({
      timezone: 'Europe/London',
      rules: WEEKDAY_WORKING_HOURS,
      busyIntervals: [],
      durationMinutes: 60,
      rangeStartYmd: '2026-06-01',
      rangeEndYmd: '2026-06-07',
      now: new Date('2026-05-31T08:00:00.000Z'),
      slotIncrementMinutes: 60,
      maxPerDay: 2,
      maxSlots: 12,
      minimumNoticeMinutes: 0,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(12);

    for (const slot of slots) {
      const localHour = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(slot.start);
      const weekday = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'short',
      }).format(slot.start);

      expect(['Sat', 'Sun']).not.toContain(weekday);
      expect(Number(localHour)).toBeGreaterThanOrEqual(9);
      expect(Number(localHour)).toBeLessThan(17);
      expect(slot.end.getTime() - slot.start.getTime()).toBe(60 * 60_000);
    }

    const days = new Set(
      slots.map((slot) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/London',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(slot.start),
      ),
    );
    expect(days.has('2026-06-06')).toBe(false);
    expect(days.has('2026-06-07')).toBe(false);
  });

  it('drops slots that overlap the organiser calendar and keeps Europe/London civil time', () => {
    const slots = suggestPollSlots({
      timezone: 'Europe/London',
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      busyIntervals: [
        {
          start: new Date('2026-06-01T08:00:00.000Z'),
          end: new Date('2026-06-01T09:00:00.000Z'),
        },
      ],
      durationMinutes: 60,
      rangeStartYmd: '2026-06-01',
      rangeEndYmd: '2026-06-01',
      now: new Date('2026-06-01T06:00:00.000Z'),
      slotIncrementMinutes: 60,
      maxPerDay: 8,
      maxSlots: 10,
      minimumNoticeMinutes: 0,
    });

    const starts = slots.map((slot) => slot.start.toISOString());
    expect(starts).not.toContain('2026-06-01T08:00:00.000Z');
    expect(starts).toContain('2026-06-01T09:00:00.000Z');
    expect(starts).toContain('2026-06-01T10:00:00.000Z');
  });

  it('does not suggest times before now', () => {
    const slots = suggestPollSlots({
      timezone: 'Europe/London',
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      busyIntervals: [],
      durationMinutes: 60,
      rangeStartYmd: '2026-06-01',
      rangeEndYmd: '2026-06-01',
      now: new Date('2026-06-01T14:00:00.000Z'),
      slotIncrementMinutes: 60,
      maxPerDay: 10,
      maxSlots: 10,
      minimumNoticeMinutes: 0,
    });

    expect(
      slots.every(
        (slot) =>
          slot.start.getTime() >= Date.parse('2026-06-01T14:00:00.000Z'),
      ),
    ).toBe(true);
    expect(slots[0]?.start.toISOString()).toBe('2026-06-01T14:00:00.000Z');
  });

  it('returns nothing when working hours are empty or the range has passed', () => {
    expect(
      suggestPollSlots({
        timezone: 'Europe/London',
        rules: [],
        busyIntervals: [],
        durationMinutes: 30,
        rangeStartYmd: '2026-06-01',
        rangeEndYmd: '2026-06-02',
        now: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).toEqual([]);

    expect(
      suggestPollSlots({
        timezone: 'Europe/London',
        rules: WEEKDAY_WORKING_HOURS,
        busyIntervals: [],
        durationMinutes: 30,
        rangeStartYmd: '2026-06-01',
        rangeEndYmd: '2026-06-02',
        now: new Date('2026-06-03T00:00:00.000Z'),
      }),
    ).toEqual([]);
  });
});

describe('slotConflictsWithBusy', () => {
  const slot = {
    start: new Date('2026-06-01T09:00:00.000Z'),
    end: new Date('2026-06-01T10:00:00.000Z'),
  };

  it('flags an overlap and ignores a slot that only touches the busy edge', () => {
    expect(
      slotConflictsWithBusy(slot, [
        {
          start: new Date('2026-06-01T09:30:00.000Z'),
          end: new Date('2026-06-01T11:00:00.000Z'),
        },
      ]),
    ).toBe(true);

    expect(
      slotConflictsWithBusy(slot, [
        {
          start: new Date('2026-06-01T10:00:00.000Z'),
          end: new Date('2026-06-01T11:00:00.000Z'),
        },
      ]),
    ).toBe(false);
  });
});
