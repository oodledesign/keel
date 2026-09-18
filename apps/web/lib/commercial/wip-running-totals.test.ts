import { describe, expect, it } from 'vitest';

import { computeWipInstructionTotals } from './wip-running-totals';

describe('computeWipInstructionTotals', () => {
  it('sums billed (won) and under-offer fees, ignoring other stages', () => {
    expect(
      computeWipInstructionTotals([
        { stage: 'completed_exchanged', value: 10_000 },
        { stage: 'signed', value: 1_500 }, // legacy → completed_exchanged
        { stage: 'under_offer_negotiating', value: 4_000 },
        { stage: 'under_offer', value: 250 }, // legacy → under_offer_negotiating
        { stage: 'current', value: 9_999 },
        { stage: 'fallen_through', value: 800 },
        { stage: 'completed_exchanged', value: null },
      ]),
    ).toEqual({
      billed: 11_500,
      underOffer: 4_250,
      total: 15_750,
    });
  });

  it('treats missing values as zero', () => {
    expect(
      computeWipInstructionTotals([
        { stage: 'completed_exchanged' },
        { stage: 'under_offer_negotiating', value: Number.NaN },
      ]),
    ).toEqual({ billed: 0, underOffer: 0, total: 0 });
  });
});
