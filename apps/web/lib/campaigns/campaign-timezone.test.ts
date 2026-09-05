import { describe, expect, it } from 'vitest';

import {
  formatZonedInstant,
  parseCampaignTimezone,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
} from './campaign-timezone';

describe('campaign timezone helpers', () => {
  it('falls back to Europe/London', () => {
    expect(parseCampaignTimezone(null)).toBe('Europe/London');
    expect(parseCampaignTimezone('not/a-zone')).toBe('Europe/London');
    expect(parseCampaignTimezone('America/New_York')).toBe('America/New_York');
  });

  it('round-trips a London winter wall clock to UTC', () => {
    const iso = zonedLocalToUtcIso('2026-01-15T09:30', 'Europe/London');
    expect(iso).toBe('2026-01-15T09:30:00.000Z');
    expect(utcIsoToZonedLocal(iso, 'Europe/London')).toBe('2026-01-15T09:30');
  });

  it('formats with a timezone short name', () => {
    const label = formatZonedInstant(
      '2026-01-15T09:30:00.000Z',
      'Europe/London',
    );
    expect(label).toContain('15');
    expect(label).toContain('2026');
  });
});
