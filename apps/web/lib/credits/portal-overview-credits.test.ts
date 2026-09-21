import { describe, expect, it } from 'vitest';

import { PORTAL_CREDIT_TOPUP_PACKS } from '../../app/portal/[slug]/_lib/types/portal-credits.types';
import {
  calendarDaysUntil,
  portalCreditsResetCopy,
} from './portal-overview-credits';

describe('PORTAL_CREDIT_TOPUP_PACKS', () => {
  it('prices 40 / 80 / 160 credits in GBP pence', () => {
    expect(PORTAL_CREDIT_TOPUP_PACKS).toEqual([
      { id: 'small', units: 40, totalPence: 3500, label: '40 credits' },
      { id: 'medium', units: 80, totalPence: 7000, label: '80 credits' },
      { id: 'large', units: 160, totalPence: 14000, label: '160 credits' },
    ]);
  });
});

describe('portalCreditsResetCopy', () => {
  const now = new Date(2026, 8, 21);

  it('falls back when no renewal date is set', () => {
    expect(portalCreditsResetCopy(null, now)).toBe('No renewal set');
    expect(portalCreditsResetCopy('not-a-date', now)).toBe('No renewal set');
  });

  it('uses calendar days until the next renewal', () => {
    expect(portalCreditsResetCopy('2026-09-21', now)).toBe('Resets today');
    expect(portalCreditsResetCopy('2026-09-22', now)).toBe('Resets in 1 day');
    expect(portalCreditsResetCopy('2026-10-05', now)).toBe('Resets in 14 days');
  });

  it('treats a past renewal date as today', () => {
    expect(portalCreditsResetCopy('2026-09-01', now)).toBe('Resets today');
  });
});

describe('calendarDaysUntil', () => {
  it('returns null for invalid dates', () => {
    expect(calendarDaysUntil('nope')).toBeNull();
  });
});
