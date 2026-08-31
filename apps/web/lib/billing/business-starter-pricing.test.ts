import { describe, expect, it } from 'vitest';

import {
  estimateStarterMonthlyBreakdownGbp,
  estimateStarterMonthlyGbp,
  formatStarterWorkedExample,
  maxProjectGuestsForStarterBillableSeats,
} from './business-starter-pricing';

describe('business starter pricing', () => {
  it('estimates 1 / 4 seat worked examples', () => {
    expect(estimateStarterMonthlyGbp(1)).toBe(14);
    // 14 + 9×3 = 41
    expect(estimateStarterMonthlyGbp(4)).toBe(41);
    // 14 + 9×9 = 95
    expect(estimateStarterMonthlyGbp(10)).toBe(95);
  });

  it('itemises two graduated bands', () => {
    expect(estimateStarterMonthlyBreakdownGbp(4)).toEqual({
      totalGbp: 41,
      lines: [
        {
          bandLabel: 'Seat 1',
          seatsInBand: 1,
          unitGbp: 14,
          subtotalGbp: 14,
        },
        {
          bandLabel: 'Seats 2+',
          seatsInBand: 3,
          unitGbp: 9,
          subtotalGbp: 27,
        },
      ],
    });
  });

  it('formats worked examples from the same breakdown', () => {
    const formatMoney = (gbp: number) => `£${gbp}`;
    expect(formatStarterWorkedExample(1, formatMoney)).toBe(
      'e.g. 1 seat = £14/mo',
    );
    expect(formatStarterWorkedExample(4, formatMoney)).toBe(
      'e.g. 4 seats = £14 + 3 × £9 = £41/mo',
    );
  });

  it('scales project guests at 1 per seat', () => {
    expect(maxProjectGuestsForStarterBillableSeats(1)).toBe(1);
    expect(maxProjectGuestsForStarterBillableSeats(4)).toBe(4);
  });
});
