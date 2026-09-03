import { describe, expect, it } from 'vitest';

import {
  formatListingRent,
  formatListingRentAmount,
  rentFrequencySuffix,
} from '../listing-money';

describe('listing-money', () => {
  it('uses pcm for per_month and pa otherwise', () => {
    expect(rentFrequencySuffix('per_month')).toBe('pcm');
    expect(rentFrequencySuffix('per_annum')).toBe('pa');
    expect(rentFrequencySuffix(null)).toBe('pa');
  });

  it('shows a rent range when from and to differ', () => {
    expect(formatListingRentAmount(55000, 75000)).toBe('£550–£750');
    expect(formatListingRent(55000, 75000, 'per_month')).toBe('£550–£750 pcm');
  });

  it('shows a single rent when there is no distinct to-value', () => {
    expect(formatListingRentAmount(55000, 55000)).toBe('£550');
    expect(formatListingRentAmount(55000, null)).toBe('£550');
    expect(formatListingRent(55000, null, 'per_annum')).toBe('£550 pa');
  });
});
