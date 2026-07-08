import { describe, expect, it } from 'vitest';

import {
  resolveWeekdayDateYmd,
  startOfWeekMonday,
  weekDayOffsetsForAnchor,
} from './plan-week-dates';

describe('plan-week-dates', () => {
  it('resolves weekdays within the Mon–Sun week containing the anchor', () => {
    // Wednesday 8 July 2026
    const anchor = '2026-07-08T12:00:00';

    expect(resolveWeekdayDateYmd(anchor, 'monday')).toBe('2026-07-06');
    expect(resolveWeekdayDateYmd(anchor, 'wednesday')).toBe('2026-07-08');
    expect(resolveWeekdayDateYmd(anchor, 'friday')).toBe('2026-07-10');
    expect(resolveWeekdayDateYmd(anchor, 'sunday')).toBe('2026-07-12');
  });

  it('uses Monday as the week start even when the anchor is Sunday', () => {
    const anchor = '2026-07-12T12:00:00';

    expect(startOfWeekMonday(new Date(anchor)).toISOString().slice(0, 10)).toBe(
      '2026-07-06',
    );
    expect(resolveWeekdayDateYmd(anchor, 'monday')).toBe('2026-07-06');
    expect(resolveWeekdayDateYmd(anchor, 'sunday')).toBe('2026-07-12');
  });

  it('returns signed offsets from the anchor date to each weekday', () => {
    const offsets = weekDayOffsetsForAnchor('2026-07-08T12:00:00');

    expect(offsets.monday).toBe(-2);
    expect(offsets.wednesday).toBe(0);
    expect(offsets.friday).toBe(2);
    expect(offsets.sunday).toBe(4);
  });
});
