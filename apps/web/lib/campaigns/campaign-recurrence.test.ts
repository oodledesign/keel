import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  addCalendarMonths,
  formatSeriesTime,
  isoWeekdayInZone,
  planSeriesInstanceGeneration,
  weekdayLabel,
  zonedTodayYmd,
} from './campaign-recurrence';

describe('campaign recurrence planner', () => {
  it('labels ISO weekdays', () => {
    expect(weekdayLabel(5)).toBe('Friday');
    expect(formatSeriesTime(12, 0)).toBe('12:00');
  });

  it('adds calendar months and clamps day-of-month', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarDays('2026-09-11', 7)).toBe('2026-09-18');
  });

  it('reads ISO weekday in a timezone', () => {
    expect(isoWeekdayInZone('2026-09-11', 'Europe/London')).toBe(5);
    expect(isoWeekdayInZone('2026-09-14', 'America/New_York')).toBe(1);
  });

  it('generates the next 4 weekly Fridays at noon London', () => {
    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      weekday: 5,
      monthday: null,
      hour: 12,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-09-01',
      generateAhead: 4,
      existing: [],
      now: new Date('2026-09-11T10:00:00.000Z'),
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
      '2026-10-02',
    ]);
    expect(planned[0]?.scheduledAt).toBe('2026-09-11T11:00:00.000Z');
    expect(planned[1]?.scheduledAt).toBe('2026-09-18T11:00:00.000Z');
  });

  it('skips a send time that has already passed today', () => {
    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      weekday: 5,
      monthday: null,
      hour: 12,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-09-01',
      generateAhead: 2,
      existing: [],
      now: new Date('2026-09-11T12:00:00.000Z'),
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-09-18',
      '2026-09-25',
    ]);
  });

  it('does not recreate existing keys and tops up after a skip', () => {
    const now = new Date('2026-09-11T10:00:00.000Z');
    const existing = [
      {
        occurrenceKey: '2026-09-11',
        scheduledAt: '2026-09-11T11:00:00.000Z',
        status: 'draft',
      },
      {
        occurrenceKey: '2026-09-18',
        scheduledAt: '2026-09-18T11:00:00.000Z',
        status: 'cancelled',
      },
    ];

    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      weekday: 5,
      monthday: null,
      hour: 12,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-09-01',
      generateAhead: 4,
      existing,
      now,
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-09-25',
      '2026-10-02',
      '2026-10-09',
    ]);
  });

  it('returns nothing when the advance window is already full', () => {
    const now = new Date('2026-09-11T10:00:00.000Z');
    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      weekday: 5,
      monthday: null,
      hour: 12,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-09-01',
      generateAhead: 2,
      existing: [
        {
          occurrenceKey: '2026-09-11',
          scheduledAt: '2026-09-11T11:00:00.000Z',
          status: 'draft',
        },
        {
          occurrenceKey: '2026-09-18',
          scheduledAt: '2026-09-18T11:00:00.000Z',
          status: 'scheduled',
        },
      ],
      now,
    });

    expect(planned).toEqual([]);
  });

  it('respects endsOn', () => {
    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      weekday: 5,
      monthday: null,
      hour: 12,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-09-11',
      endsOn: '2026-09-18',
      generateAhead: 4,
      existing: [],
      now: new Date('2026-09-11T10:00:00.000Z'),
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-09-11',
      '2026-09-18',
    ]);
  });

  it('supports fortnightly interval', () => {
    const planned = planSeriesInstanceGeneration({
      freq: 'weekly',
      interval: 2,
      weekday: 5,
      monthday: null,
      hour: 9,
      minute: 30,
      timezone: 'Europe/London',
      startsOn: '2026-09-11',
      generateAhead: 3,
      existing: [],
      now: new Date('2026-09-11T08:00:00.000Z'),
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-09-11',
      '2026-09-25',
      '2026-10-09',
    ]);
  });

  it('plans monthly occurrences for a later freq without a schema change', () => {
    const planned = planSeriesInstanceGeneration({
      freq: 'monthly',
      weekday: null,
      monthday: 31,
      hour: 9,
      minute: 0,
      timezone: 'Europe/London',
      startsOn: '2026-01-01',
      generateAhead: 3,
      existing: [],
      now: new Date('2026-01-15T08:00:00.000Z'),
    });

    expect(planned.map((row) => row.occurrenceKey)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('formats today in zone', () => {
    expect(
      zonedTodayYmd(new Date('2026-09-11T23:30:00.000Z'), 'Pacific/Auckland'),
    ).toBe('2026-09-12');
  });
});
