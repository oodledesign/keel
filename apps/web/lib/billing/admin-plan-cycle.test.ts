import { describe, expect, it } from 'vitest';

import {
  addMonthsToIsoDate,
  adminPlanCycleExpiresAt,
  nextAdminPlanCycle,
} from './admin-plan-cycle';

describe('addMonthsToIsoDate', () => {
  it('adds calendar months', () => {
    expect(addMonthsToIsoDate('2026-10-08', 1)).toBe('2026-11-08');
    expect(addMonthsToIsoDate('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('clamps to the last day of shorter months', () => {
    expect(addMonthsToIsoDate('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsToIsoDate('2027-01-31', 2)).toBe('2027-03-31');
  });
});

describe('nextAdminPlanCycle', () => {
  it('returns null while the cycle is still live', () => {
    expect(
      nextAdminPlanCycle('2026-10-17', new Date('2026-10-09T12:00:00Z')),
    ).toBeNull();
  });

  it('starts the next cycle on the day the old one ends', () => {
    expect(
      nextAdminPlanCycle('2026-10-08', new Date('2026-10-08T00:05:00Z')),
    ).toEqual({ cycleStart: '2026-10-08', cycleEnd: '2026-11-08' });
  });

  it('rolls forward past missed months', () => {
    expect(
      nextAdminPlanCycle('2026-08-04', new Date('2026-10-09T12:00:00Z')),
    ).toEqual({ cycleStart: '2026-10-04', cycleEnd: '2026-11-04' });
  });

  it('keeps the anchor day after a short month', () => {
    expect(
      nextAdminPlanCycle('2027-01-31', new Date('2027-03-01T00:00:00Z')),
    ).toEqual({ cycleStart: '2027-02-28', cycleEnd: '2027-03-31' });
  });

  it('starts today when the pool has no cycle yet', () => {
    expect(nextAdminPlanCycle(null, new Date('2026-10-09T12:00:00Z'))).toEqual({
      cycleStart: '2026-10-09',
      cycleEnd: '2026-11-09',
    });
  });
});

describe('adminPlanCycleExpiresAt', () => {
  it('expires at the start of the cycle end date', () => {
    expect(adminPlanCycleExpiresAt('2026-11-08')).toBe(
      '2026-11-08T00:00:00.000Z',
    );
  });
});
