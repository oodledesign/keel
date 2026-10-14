import { describe, expect, it } from 'vitest';

import {
  annualRentPounds,
  describeRightmoveRent,
  formatAnnualRent,
  formatRent,
  rentBasis,
  rentWarnings,
  rightmoveRent,
  unitRentFromListing,
} from '../listing-rent';

const perSqft = {
  askingRentPence: 2600,
  askingRentToPence: null,
  rentFrequency: 'per_sqft',
  sizeMinSqft: 2152,
  sizeMaxSqft: 7350,
};

describe('rentBasis', () => {
  it('reads stored and imported frequencies', () => {
    expect(rentBasis('per_sqft')).toBe('per_sqft');
    expect(rentBasis('£ psf')).toBe('per_sqft');
    expect(rentBasis('per_month')).toBe('per_month');
    expect(rentBasis('PCM')).toBe('per_month');
    expect(rentBasis('per_annum')).toBe('per_annum');
    expect(rentBasis(null)).toBe('per_annum');
  });
});

describe('formatRent', () => {
  it('keeps pence on rates and drops them on totals', () => {
    expect(formatRent(1075, null, 'per_sqft')).toBe('£10.75 per sq ft');
    expect(formatRent(150, 300, 'per_sqft', 'short')).toBe('£1.50–£3.00 psf');
    expect(formatRent(2600, null, 'per_sqft')).toBe('£26 per sq ft');
    expect(formatRent(4_200_000, null, 'per_annum', 'short')).toBe(
      '£42,000 pa',
    );
    expect(formatRent(null, null, 'per_annum')).toBeNull();
  });
});

describe('annualRentPounds', () => {
  it('multiplies a per sq ft rate by the size range', () => {
    expect(annualRentPounds(perSqft)).toEqual({ from: 55952, to: 191100 });
    expect(formatAnnualRent({ from: 55952, to: 191100 })).toBe(
      '£55,952–£191,100 per annum',
    );
  });

  it('pairs the low rate with the smallest size and the high rate with the largest', () => {
    expect(
      annualRentPounds({
        ...perSqft,
        askingRentPence: 150,
        askingRentToPence: 300,
        sizeMinSqft: 4356,
        sizeMaxSqft: 10000,
      }),
    ).toEqual({ from: 6534, to: 30000 });
  });

  it('annualises a monthly rent', () => {
    expect(
      annualRentPounds({
        ...perSqft,
        askingRentPence: 100_000,
        rentFrequency: 'per_month',
      }),
    ).toEqual({ from: 12000, to: 12000 });
  });

  it('returns null without a size or with an implausible rate', () => {
    expect(
      annualRentPounds({ ...perSqft, sizeMinSqft: null, sizeMaxSqft: null }),
    ).toBeNull();
    expect(
      annualRentPounds({ ...perSqft, askingRentPence: 6_800_000 }),
    ).toBeNull();
  });
});

describe('rentWarnings', () => {
  it('flags a yearly total entered as a rate', () => {
    expect(rentWarnings({ ...perSqft, askingRentPence: 6_800_000 })).toEqual([
      'rate_looks_like_total',
    ]);
  });

  it('flags a rate entered as a yearly total', () => {
    expect(rentWarnings({ ...perSqft, rentFrequency: 'per_annum' })).toEqual([
      'total_looks_like_rate',
    ]);
  });

  it('asks for a size on a per sq ft rent', () => {
    expect(
      rentWarnings({ ...perSqft, sizeMinSqft: null, sizeMaxSqft: null }),
    ).toEqual(['rate_needs_size']);
  });

  it('is quiet for a sensible rent', () => {
    expect(rentWarnings(perSqft)).toEqual([]);
  });
});

describe('rightmoveRent', () => {
  it('sends per sq ft rents as a From yearly total', () => {
    const rent = rightmoveRent({ ...perSqft, hideRent: false });
    expect(rent).toEqual({
      price: 55952,
      frequency: 'YEARLY',
      from: true,
      poa: false,
    });
    expect(describeRightmoveRent(rent)).toBe('From £55,952 per annum');
  });

  it('shows POA when hidden or when no total can be worked out', () => {
    expect(
      describeRightmoveRent(rightmoveRent({ ...perSqft, hideRent: true })),
    ).toBe('Price on application');
    expect(
      rightmoveRent({
        ...perSqft,
        sizeMinSqft: null,
        sizeMaxSqft: null,
        hideRent: false,
      }).poa,
    ).toBe(true);
  });

  it('keeps monthly rents monthly', () => {
    const rent = rightmoveRent({
      ...perSqft,
      askingRentPence: 150_000,
      rentFrequency: 'per_month',
      hideRent: false,
    });
    expect(describeRightmoveRent(rent)).toBe('£1,500 per month');
  });
});

describe('unitRentFromListing', () => {
  it('prices a unit from the disposal rate', () => {
    expect(unitRentFromListing({ ...perSqft, unitSizeSqft: 1000 })).toEqual({
      price: 26000,
      frequency: 'YEARLY',
    });
    expect(unitRentFromListing({ ...perSqft, unitSizeSqft: null })).toBeNull();
  });
});
