import { describe, expect, it } from 'vitest';

import { formatEmailDateTime } from './format-email-date';

describe('formatEmailDateTime', () => {
  it('returns time only for today', () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);

    expect(formatEmailDateTime(now.toISOString())).toMatch(/14:30/);
  });

  it('returns day, month, and time for earlier this year', () => {
    const date = new Date('2026-03-15T09:05:00.000Z');

    expect(formatEmailDateTime(date.toISOString())).toContain('Mar');
    expect(formatEmailDateTime(date.toISOString())).toContain(':');
  });

  it('returns empty string for invalid values', () => {
    expect(formatEmailDateTime(null)).toBe('');
    expect(formatEmailDateTime('not-a-date')).toBe('');
  });
});
