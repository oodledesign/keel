import { describe, expect, it } from 'vitest';

import {
  formatUtcInTimezone,
  localDateTimeInTimezoneToUtcIso,
} from './zoned-local-datetime';

describe('localDateTimeInTimezoneToUtcIso', () => {
  it('converts London winter local time to UTC', () => {
    const iso = localDateTimeInTimezoneToUtcIso(
      '2026-01-15',
      '09:00',
      'Europe/London',
    );
    expect(iso).toBe('2026-01-15T09:00:00.000Z');
  });

  it('converts London summer local time to UTC (BST)', () => {
    const iso = localDateTimeInTimezoneToUtcIso(
      '2026-07-15',
      '09:00',
      'Europe/London',
    );
    expect(iso).toBe('2026-07-15T08:00:00.000Z');
  });
});

describe('formatUtcInTimezone', () => {
  it('formats UTC instant back to London fields', () => {
    const formatted = formatUtcInTimezone(
      '2026-07-15T08:00:00.000Z',
      'Europe/London',
    );
    expect(formatted.date).toBe('2026-07-15');
    expect(formatted.time).toBe('09:00');
  });
});
