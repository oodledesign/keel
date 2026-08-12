import { describe, expect, it } from 'vitest';

import {
  clampBillableSeats,
  estimateMonthlyBreakdownGbp,
  estimateMonthlyGbp,
  formatGraduatedWorkedExample,
  freeSupportSeats,
  illustrativeTierForSeats,
  maxMembersForBillableSeats,
  portalPublishingAllowed,
} from './commercial-graduated-pricing';

describe('commercial graduated pricing', () => {
  it('estimates Solo / Team / Scale worked examples', () => {
    expect(estimateMonthlyGbp(1)).toBe(89);
    // 89 + 55×3 = 254
    expect(estimateMonthlyGbp(4)).toBe(254);
    // 89 + 55×6 + 39×3 = 89 + 330 + 117 = 536
    expect(estimateMonthlyGbp(10)).toBe(536);
  });

  it('itemises graduated bands for the calculator', () => {
    expect(estimateMonthlyBreakdownGbp(4)).toEqual({
      totalGbp: 254,
      lines: [
        {
          bandLabel: 'Seat 1',
          seatsInBand: 1,
          unitGbp: 89,
          subtotalGbp: 89,
        },
        {
          bandLabel: 'Seats 2–7',
          seatsInBand: 3,
          unitGbp: 55,
          subtotalGbp: 165,
        },
      ],
    });

    expect(estimateMonthlyBreakdownGbp(10).lines).toEqual([
      {
        bandLabel: 'Seat 1',
        seatsInBand: 1,
        unitGbp: 89,
        subtotalGbp: 89,
      },
      {
        bandLabel: 'Seats 2–7',
        seatsInBand: 6,
        unitGbp: 55,
        subtotalGbp: 330,
      },
      {
        bandLabel: 'Seats 8+',
        seatsInBand: 3,
        unitGbp: 39,
        subtotalGbp: 117,
      },
    ]);
  });

  it('formats worked examples from the same breakdown', () => {
    const formatMoney = (gbp: number) => `£${gbp}`;
    expect(formatGraduatedWorkedExample(4, formatMoney)).toBe(
      'e.g. 4 seats = £89 + 3 × £55 = £254/mo',
    );
    expect(formatGraduatedWorkedExample(10, formatMoney)).toBe(
      'e.g. 10 seats = £89 + 6 × £55 + 3 × £39 = £536/mo',
    );
  });

  it('holds band boundaries at 7 and 8 seats', () => {
    expect(estimateMonthlyBreakdownGbp(7).totalGbp).toBe(89 + 6 * 55);
    expect(estimateMonthlyBreakdownGbp(8).lines).toHaveLength(3);
    expect(estimateMonthlyBreakdownGbp(8).totalGbp).toBe(89 + 6 * 55 + 39);
  });

  it('returns free support seats by band', () => {
    expect(freeSupportSeats(1)).toBe(0);
    expect(freeSupportSeats(2)).toBe(2);
    expect(freeSupportSeats(7)).toBe(2);
    expect(freeSupportSeats(8)).toBe(4);
  });

  it('computes max memberships including free support', () => {
    expect(maxMembersForBillableSeats(1)).toBe(1);
    expect(maxMembersForBillableSeats(4)).toBe(6);
    expect(maxMembersForBillableSeats(10)).toBe(14);
  });

  it('includes portal publishing from seat 1', () => {
    expect(portalPublishingAllowed(1)).toBe(true);
    expect(portalPublishingAllowed(2)).toBe(true);
  });

  it('maps illustrative labels and clamps seats', () => {
    expect(illustrativeTierForSeats(1).id).toBe('solo');
    expect(illustrativeTierForSeats(5).id).toBe('team');
    expect(illustrativeTierForSeats(12).id).toBe('scale');
    expect(clampBillableSeats(0)).toBe(1);
    expect(clampBillableSeats(3.9)).toBe(3);
  });
});
