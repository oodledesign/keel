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

describe('business graduated pricing', () => {
  it('estimates Solo / Team / Scale worked examples', () => {
    expect(estimateMonthlyGbp(1)).toBe(29);
    // 29 + 22×3 = 95
    expect(estimateMonthlyGbp(4)).toBe(95);
    // 29 + 22×4 + 16×5 = 29 + 88 + 80 = 197
    expect(estimateMonthlyGbp(10)).toBe(197);
    // 29 + 22×4 + 16×10 = 29 + 88 + 160 = 277
    expect(estimateMonthlyGbp(15)).toBe(277);
  });

  it('itemises graduated bands for the calculator', () => {
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
          bandLabel: 'Seats 2–5',
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
        bandLabel: 'Seats 2–5',
        seatsInBand: 4,
        unitGbp: 22,
        subtotalGbp: 88,
      },
      {
        bandLabel: 'Seats 6+',
        seatsInBand: 5,
        unitGbp: 16,
        subtotalGbp: 80,
      },
    ]);
  });

  it('formats worked examples from the same breakdown', () => {
    const formatMoney = (gbp: number) => `£${gbp}`;
    expect(formatGraduatedWorkedExample(4, formatMoney)).toBe(
      'e.g. 4 seats = £29 + 3 × £22 = £95/mo',
    );
    expect(formatGraduatedWorkedExample(10, formatMoney)).toBe(
      'e.g. 10 seats = £29 + 4 × £22 + 5 × £16 = £197/mo',
    );
  });

  it('holds band boundaries at 5 and 6 seats', () => {
    expect(estimateMonthlyBreakdownGbp(5).totalGbp).toBe(29 + 4 * 22);
    expect(estimateMonthlyBreakdownGbp(6).lines).toHaveLength(3);
    expect(estimateMonthlyBreakdownGbp(6).totalGbp).toBe(29 + 4 * 22 + 16);
  });

  it('scales shared AI credits sub-linearly', () => {
    expect(aiCreditsForBillableSeats(1)).toBe(3000);
    // 3k + 4×1.5k = 9k
    expect(aiCreditsForBillableSeats(5)).toBe(9000);
    // 9k + 10×1k = 19k
    expect(aiCreditsForBillableSeats(15)).toBe(19000);
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
