import { describe, expect, it } from 'vitest';

import {
  aiCreditsForBillableSeats,
  clampBillableSeats,
  estimateMonthlyBreakdownGbp,
  estimateMonthlyGbp,
  formatGraduatedWorkedExample,
  illustrativeTierForSeats,
  maxMembersForBillableSeats,
  maxProjectGuestsForBillableSeats,
} from './business-graduated-pricing';

describe('business graduated pricing (two-band Pro)', () => {
  it('estimates 1 / 4 / 10 seat worked examples', () => {
    expect(estimateMonthlyGbp(1)).toBe(29);
    // 29 + 22×3 = 95
    expect(estimateMonthlyGbp(4)).toBe(95);
    // 29 + 22×9 = 227
    expect(estimateMonthlyGbp(10)).toBe(227);
    // 29 + 22×14 = 337
    expect(estimateMonthlyGbp(15)).toBe(337);
  });

  it('itemises two graduated bands for the calculator', () => {
    expect(estimateMonthlyBreakdownGbp(4)).toEqual({
      totalGbp: 95,
      lines: [
        {
          bandLabel: 'Seat 1',
          seatsInBand: 1,
          unitGbp: 29,
          subtotalGbp: 29,
        },
        {
          bandLabel: 'Seats 2+',
          seatsInBand: 3,
          unitGbp: 22,
          subtotalGbp: 66,
        },
      ],
    });

    expect(estimateMonthlyBreakdownGbp(10).lines).toEqual([
      {
        bandLabel: 'Seat 1',
        seatsInBand: 1,
        unitGbp: 29,
        subtotalGbp: 29,
      },
      {
        bandLabel: 'Seats 2+',
        seatsInBand: 9,
        unitGbp: 22,
        subtotalGbp: 198,
      },
    ]);
  });

  it('formats worked examples from the same breakdown', () => {
    const formatMoney = (gbp: number) => `£${gbp}`;
    expect(formatGraduatedWorkedExample(4, formatMoney)).toBe(
      'e.g. 4 seats = £29 + 3 × £22 = £95/mo',
    );
    expect(formatGraduatedWorkedExample(10, formatMoney)).toBe(
      'e.g. 10 seats = £29 + 9 × £22 = £227/mo',
    );
  });

  it('keeps the additional-seat rate at £22 after five seats', () => {
    expect(estimateMonthlyBreakdownGbp(5).totalGbp).toBe(29 + 4 * 22);
    expect(estimateMonthlyBreakdownGbp(6).lines).toHaveLength(2);
    expect(estimateMonthlyBreakdownGbp(6).totalGbp).toBe(29 + 5 * 22);
  });

  it('scales shared AI credits in two bands', () => {
    expect(aiCreditsForBillableSeats(1)).toBe(3000);
    // 3k + 4×1.5k = 9k
    expect(aiCreditsForBillableSeats(5)).toBe(9000);
    // 3k + 14×1.5k = 24k
    expect(aiCreditsForBillableSeats(15)).toBe(24000);
  });

  it('scales project guests at 3 per seat', () => {
    expect(maxProjectGuestsForBillableSeats(1)).toBe(3);
    expect(maxProjectGuestsForBillableSeats(5)).toBe(15);
    expect(maxProjectGuestsForBillableSeats(15)).toBe(45);
  });

  it('sets max memberships equal to billable seats', () => {
    expect(maxMembersForBillableSeats(1)).toBe(1);
    expect(maxMembersForBillableSeats(4)).toBe(4);
    expect(maxMembersForBillableSeats(10)).toBe(10);
  });

  it('maps illustrative labels and clamps seats', () => {
    expect(illustrativeTierForSeats(1).id).toBe('solo');
    expect(illustrativeTierForSeats(5).id).toBe('team');
    expect(illustrativeTierForSeats(12).id).toBe('scale');
    expect(clampBillableSeats(0)).toBe(1);
    expect(clampBillableSeats(3.9)).toBe(3);
  });
});
