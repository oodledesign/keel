import { describe, expect, it } from 'vitest';

import {
  isPaymentPlanTotalValid,
  sumPaymentPlanPercent,
} from './payment-plan';

describe('sumPaymentPlanPercent', () => {
  it('sums percentages and rounds to 2dp', () => {
    expect(
      sumPaymentPlanPercent([
        { percent: 33.33 },
        { percent: 33.33 },
        { percent: 33.34 },
      ]),
    ).toBe(100);
  });

  it('ignores non-finite values when summing', () => {
    expect(
      sumPaymentPlanPercent([{ percent: 50 }, { percent: Number.NaN }]),
    ).toBe(50);
  });

  it('returns 0 for an empty plan', () => {
    expect(sumPaymentPlanPercent([])).toBe(0);
  });
});

describe('isPaymentPlanTotalValid', () => {
  it('accepts an empty plan (no instalments configured)', () => {
    expect(isPaymentPlanTotalValid([])).toBe(true);
  });

  it('accepts rows that total exactly 100%', () => {
    expect(
      isPaymentPlanTotalValid([{ percent: 50 }, { percent: 50 }]),
    ).toBe(true);
  });

  it('accepts rows that total 100% within floating point tolerance', () => {
    expect(
      isPaymentPlanTotalValid([
        { percent: 33.33 },
        { percent: 33.33 },
        { percent: 33.34 },
      ]),
    ).toBe(true);
  });

  it('rejects rows that do not total 100%', () => {
    expect(
      isPaymentPlanTotalValid([{ percent: 40 }, { percent: 40 }]),
    ).toBe(false);
  });

  it('rejects a negative percent', () => {
    expect(
      isPaymentPlanTotalValid([{ percent: 120 }, { percent: -20 }]),
    ).toBe(false);
  });

  it('rejects a percent above 100', () => {
    expect(isPaymentPlanTotalValid([{ percent: 150 }])).toBe(false);
  });

  it('rejects malformed (NaN/Infinity) percentages', () => {
    expect(isPaymentPlanTotalValid([{ percent: Number.NaN }])).toBe(false);
    expect(isPaymentPlanTotalValid([{ percent: Number.POSITIVE_INFINITY }])).toBe(
      false,
    );
  });

  it('rejects a single 100% row followed by extra rows summing over 100%', () => {
    expect(
      isPaymentPlanTotalValid([{ percent: 100 }, { percent: 10 }]),
    ).toBe(false);
  });
});
