import { describe, expect, it } from 'vitest';

import { FALLBACK_UNITS_PER_GBP, convertMinorUnits } from './estimate-fx';

describe('convertMinorUnits', () => {
  it('leaves same-currency amounts unchanged', () => {
    expect(convertMinorUnits(12345, 'gbp', 'gbp')).toBe(12345);
  });

  it('converts USD cents to GBP pence via units-per-GBP', () => {
    const usd = 12700;
    expect(
      convertMinorUnits(usd, 'usd', 'gbp', {
        ...FALLBACK_UNITS_PER_GBP,
        usd: 1.27,
      }),
    ).toBe(10000);
  });

  it('converts GBP pence to EUR cents', () => {
    expect(
      convertMinorUnits(10000, 'gbp', 'eur', {
        ...FALLBACK_UNITS_PER_GBP,
        eur: 1.17,
      }),
    ).toBe(11700);
  });
});
