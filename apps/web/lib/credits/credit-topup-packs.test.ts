import { describe, expect, it } from 'vitest';

import {
  CreditTopupPackListSchema,
  DEFAULT_CREDIT_TOPUP_PACKS,
  resolveCreditTopupPacks,
} from './credit-topup-packs';

describe('resolveCreditTopupPacks', () => {
  it('uses the 40 / 80 / 160 defaults when nothing is stored', () => {
    expect(resolveCreditTopupPacks(null)).toEqual({
      packs: [
        { id: '40-credits', units: 40, totalPence: 3500, label: '40 credits' },
        { id: '80-credits', units: 80, totalPence: 7000, label: '80 credits' },
        {
          id: '160-credits',
          units: 160,
          totalPence: 14000,
          label: '160 credits',
        },
      ],
      isCustom: false,
    });
  });

  it('sorts custom packs by credits', () => {
    const result = resolveCreditTopupPacks([
      { units: 100, totalPence: 9000 },
      { units: 25, totalPence: 2500 },
    ]);
    expect(result.isCustom).toBe(true);
    expect(result.packs.map((pack) => pack.units)).toEqual([25, 100]);
  });

  it('treats an empty list as top-ups turned off', () => {
    expect(resolveCreditTopupPacks([])).toEqual({ packs: [], isCustom: true });
  });

  it('falls back to defaults for invalid stored data', () => {
    expect(resolveCreditTopupPacks([{ units: 'lots' }])).toEqual({
      packs: DEFAULT_CREDIT_TOPUP_PACKS,
      isCustom: false,
    });
  });
});

describe('CreditTopupPackListSchema', () => {
  it('rejects duplicate credit amounts', () => {
    expect(
      CreditTopupPackListSchema.safeParse([
        { units: 40, totalPence: 3500 },
        { units: 40, totalPence: 3000 },
      ]).success,
    ).toBe(false);
  });

  it('rejects prices under £1', () => {
    expect(
      CreditTopupPackListSchema.safeParse([{ units: 10, totalPence: 50 }])
        .success,
    ).toBe(false);
  });
});
