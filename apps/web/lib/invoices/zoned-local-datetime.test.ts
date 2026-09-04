import { describe, expect, it } from 'vitest';

import {
  endOfZonedDay,
  formatUtcInTimezone,
  localDateTimeInTimezoneToUtcIso,
} from './zoned-local-datetime';

const LONDON = 'Europe/London';

function isDue(nextIssueAt: string, now: Date) {
  return nextIssueAt <= endOfZonedDay(now, LONDON).toISOString();
}

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

describe('endOfZonedDay (Europe/London)', () => {
  it('ends BST 1 Sep at 22:59:59.999 UTC, not 23:59 UTC', () => {
    const now = new Date('2026-09-01T08:15:00.000Z');
    expect(endOfZonedDay(now, LONDON).toISOString()).toBe(
      '2026-09-01T22:59:59.999Z',
    );
  });

  it('ends GMT 1 Jan at 23:59:59.999 UTC', () => {
    const now = new Date('2026-01-01T08:15:00.000Z');
    expect(endOfZonedDay(now, LONDON).toISOString()).toBe(
      '2026-01-01T23:59:59.999Z',
    );
  });

  it('treats noon-UK next_issue_at as due before the 08:15 UTC cron on the 1st (BST)', () => {
    const now = new Date('2026-09-01T08:15:00.000Z');
    expect(isDue('2026-09-01T11:00:00.000Z', now)).toBe(true);
  });

  it('does not treat next month as due', () => {
    const now = new Date('2026-09-01T08:15:00.000Z');
    expect(isDue('2026-10-01T11:00:00.000Z', now)).toBe(false);
  });

  it('keeps yesterday overdue so the next cron retries', () => {
    const now = new Date('2026-09-02T08:15:00.000Z');
    expect(isDue('2026-09-01T11:00:00.000Z', now)).toBe(true);
  });

  it('still treats noon-UK as due after 11:00 UTC on the same 1st', () => {
    const now = new Date('2026-09-01T15:00:00.000Z');
    expect(isDue('2026-09-01T11:00:00.000Z', now)).toBe(true);
  });

  it('treats a late-afternoon next_issue_at as due even after the 08:15 cron', () => {
    const now = new Date('2026-09-01T08:15:00.000Z');
    // 18:00 London BST = 17:00 UTC — after the cron, same London date
    expect(isDue('2026-09-01T17:00:00.000Z', now)).toBe(true);
  });

  it('ends BST 30 Sep at 22:59:59.999 UTC (month rollover)', () => {
    const now = new Date('2026-09-30T08:15:00.000Z');
    expect(endOfZonedDay(now, LONDON).toISOString()).toBe(
      '2026-09-30T22:59:59.999Z',
    );
  });

  it('treats noon-UK as due before the cron on a GMT 1st', () => {
    const now = new Date('2026-01-01T08:15:00.000Z');
    expect(isDue('2026-01-01T12:00:00.000Z', now)).toBe(true);
    expect(isDue('2026-02-01T12:00:00.000Z', now)).toBe(false);
  });
});
