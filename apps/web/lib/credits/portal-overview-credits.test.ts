import { describe, expect, it } from 'vitest';

import {
  calendarDaysUntil,
  portalCreditsHasRenewal,
  portalCreditsNextSteps,
  portalCreditsResetCopy,
} from './portal-overview-credits';

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

describe('portalCreditsNextSteps', () => {
  const now = new Date(2026, 8, 21);

  it('offers Top up when the balance is empty', () => {
    expect(portalCreditsNextSteps(0, '2026-10-05', now)).toEqual({
      topUp: true,
      billing: false,
    });
  });

  it('offers Billing when no renewal is set', () => {
    expect(portalCreditsHasRenewal(null, now)).toBe(false);
    expect(portalCreditsNextSteps(12, null, now)).toEqual({
      topUp: false,
      billing: true,
    });
  });

  it('offers both when credits and renewal are missing', () => {
    expect(portalCreditsNextSteps(0, 'not-a-date', now)).toEqual({
      topUp: true,
      billing: true,
    });
  });
});
