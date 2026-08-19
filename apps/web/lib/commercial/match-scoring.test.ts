import { describe, expect, it } from 'vitest';

import {
  type MatchListingSnapshot,
  type MatchRequirementSnapshot,
  scoreListingRequirementMatch,
} from './match-scoring';

const baseListing: MatchListingSnapshot = {
  id: 'l1',
  name: 'Unit 4 Riverside',
  sector: 'industrial',
  disposalType: 'to_let',
  town: 'Manchester',
  postcode: 'M17 1AB',
  addressLine1: 'Trafford Park',
  latitude: null,
  longitude: null,
  sizeMinSqft: 8000,
  sizeMaxSqft: 12000,
  askingRentPence: 12_000_000, // £120,000/year in pence
  askingRentToPence: null,
  askingPricePence: null,
  status: 'marketing',
};

const baseRequirement: MatchRequirementSnapshot = {
  id: 'r1',
  companyName: 'Acme Logistics',
  contactName: 'Sam',
  sector: 'warehouse',
  tenure: 'rent',
  locationText: 'Manchester Trafford Park',
  latitude: null,
  longitude: null,
  searchRadiusMiles: null,
  sizeMinSqft: 7000,
  sizeMaxSqft: 15000,
  budgetMinPence: null,
  budgetMaxPence: 15_000_000, // £150,000/year in pence
  notes: null,
  stage: 'actively_searching',
  updatedAt: new Date().toISOString(),
};

describe('scoreListingRequirementMatch', () => {
  it('scores a strong industrial rent fit highly', () => {
    const result = scoreListingRequirementMatch(baseListing, baseRequirement);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons.some((r) => /sector/i.test(r))).toBe(true);
    expect(
      result.reasons.some((r) => /location|size|tenure|budget/i.test(r)),
    ).toBe(true);
  });

  it('penalises tenure mismatch', () => {
    const result = scoreListingRequirementMatch(baseListing, {
      ...baseRequirement,
      tenure: 'buy',
    });
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.reasons[0]).toMatch(/tenure mismatch/i);
  });

  it('handles for sale + buy', () => {
    const result = scoreListingRequirementMatch(
      {
        ...baseListing,
        disposalType: 'for_sale',
        askingRentPence: null,
        askingPricePence: 250_000_000, // £2.5m in pence
      },
      {
        ...baseRequirement,
        tenure: 'buy',
        budgetMaxPence: 300_000_000, // £3m in pence
      },
    );
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  it('gives full location weight inside search radius', () => {
    const result = scoreListingRequirementMatch(
      {
        ...baseListing,
        latitude: 53.48,
        longitude: -2.24,
      },
      {
        ...baseRequirement,
        latitude: 53.48,
        longitude: -2.25,
        searchRadiusMiles: 10,
        locationText: null,
      },
    );
    expect(result.breakdown.location).toBe(20);
    expect(result.reasons.some((r) => /search radius/i.test(r))).toBe(true);
  });

  it('zeros location when outside search radius', () => {
    const result = scoreListingRequirementMatch(
      {
        ...baseListing,
        latitude: 53.48,
        longitude: -2.24,
        town: null,
        postcode: null,
        addressLine1: null,
      },
      {
        ...baseRequirement,
        // ~200 miles away
        latitude: 51.5,
        longitude: -0.12,
        searchRadiusMiles: 10,
        locationText: null,
      },
    );
    expect(result.breakdown.location).toBe(0);
    expect(result.reasons.some((r) => /outside search radius/i.test(r))).toBe(
      true,
    );
  });

  it('treats this-area-only (0 miles) as a tight radius', () => {
    const result = scoreListingRequirementMatch(
      {
        ...baseListing,
        latitude: 53.48,
        longitude: -2.24,
      },
      {
        ...baseRequirement,
        latitude: 53.48,
        longitude: -2.241,
        searchRadiusMiles: 0,
        locationText: null,
      },
    );
    expect(result.breakdown.location).toBe(20);
  });

  it('differentiates incomplete briefs by size overlap', () => {
    const sparse = {
      ...baseRequirement,
      sector: null,
      locationText: null,
      budgetMinPence: null,
      budgetMaxPence: null,
    };

    const tight = scoreListingRequirementMatch(baseListing, {
      ...sparse,
      sizeMinSqft: 9000,
      sizeMaxSqft: 11000,
    });
    const loose = scoreListingRequirementMatch(baseListing, {
      ...sparse,
      sizeMinSqft: 1000,
      sizeMaxSqft: 50000,
    });

    expect(tight.score).not.toEqual(loose.score);
    expect(tight.score).toBeGreaterThan(loose.score);
  });
});
