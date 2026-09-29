import { describe, expect, it } from 'vitest';

import { computeWipInstructionTotals } from './wip-running-totals';

describe('computeWipInstructionTotals', () => {
  it('sums billed-stage fees and under-offer plus negotiating', () => {
    expect(
      computeWipInstructionTotals([
        { stage: 'billed', value: 10_000 },
        { stage: 'completed', value: 9_000 },
        { stage: 'completed_exchanged', value: 1_500 },
        { stage: 'signed', value: 400 },
        { stage: 'under_offer', value: 4_000 },
        { stage: 'negotiating', value: 250 },
        { stage: 'under_offer_negotiating', value: 100 },
        { stage: 'current', value: 9_999 },
        { stage: 'fallen_through', value: 800 },
        { stage: 'billed', value: null },
      ]),
    ).toEqual({
      billed: 10_000,
      underOffer: 4_350,
      total: 14_350,
    });
  });

  it('treats missing values as zero', () => {
    expect(
      computeWipInstructionTotals([
        { stage: 'billed' },
        { stage: 'negotiating', value: Number.NaN },
      ]),
    ).toEqual({ billed: 0, underOffer: 0, total: 0 });
  });
});
