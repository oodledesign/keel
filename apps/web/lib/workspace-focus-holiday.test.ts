import { describe, expect, it } from 'vitest';

import {
  holidayBackOnStartMs,
  isHolidayUntilExpired,
} from '~/lib/workspace-focus';

describe('holiday back-on expiry', () => {
  it('treats start of the Back on UTC day as expired', () => {
    // Legacy end-of-day storage for "Back on 25 Aug"
    const until = '2026-08-25T23:59:59.000Z';
    expect(holidayBackOnStartMs(until)).toBe(
      Date.UTC(2026, 7, 25, 0, 0, 0, 0),
    );
    expect(
      isHolidayUntilExpired(until, new Date('2026-08-25T08:00:00.000Z')),
    ).toBe(true);
    expect(
      isHolidayUntilExpired(until, new Date('2026-08-24T23:00:00.000Z')),
    ).toBe(false);
  });

  it('works with start-of-day storage', () => {
    const until = '2026-08-25T00:00:00.000Z';
    expect(
      isHolidayUntilExpired(until, new Date('2026-08-25T00:00:00.000Z')),
    ).toBe(true);
    expect(
      isHolidayUntilExpired(until, new Date('2026-08-24T23:59:59.000Z')),
    ).toBe(false);
  });
});
