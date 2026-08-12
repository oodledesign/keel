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
});
