import { describe, expect, it } from 'vitest';

import {
  type MatchListing,
  type MatchRequirement,
  scoreMatch,
  suggestMatchesSchema,
} from './commercial-matching';

const listing: MatchListing = {
  id: 'l',
  name: 'Unit 4',
  sector: 'Industrial',
  disposalType: 'to_let',
  town: 'Leeds',
  postcode: 'LS10',
  addressLine1: null,
  latitude: null,
  longitude: null,
  sizeMinSqft: 5000,
  sizeMaxSqft: 10000,
  askingRentPence: 700000,
  askingRentToPence: null,
  askingPricePence: null,
};
const req: MatchRequirement = {
  id: 'r',
  companyName: 'Acme',
  contactName: null,
  sector: 'warehouse',
  tenure: 'rent',
  locationText: 'Leeds',
  latitude: null,
  longitude: null,
  searchRadiusMiles: null,
  sizeMinSqft: 5000,
  sizeMaxSqft: 10000,
  budgetMinPence: null,
  budgetMaxPence: 1000000,
};

describe('commercial matching', () => {
  it('scores a strong fit highly', () => {
    const result = scoreMatch(listing, req);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.reasons.join(' ')).toMatch(/Sector match/);
  });

  it('caps a tenure mismatch', () => {
    const result = scoreMatch({ ...listing, disposalType: 'for_sale' }, req);
    expect(result.score).toBeLessThanOrEqual(20);
  });

  it('needs exactly one side to suggest from', () => {
    expect(() => suggestMatchesSchema.parse({})).toThrow();
    expect(() =>
      suggestMatchesSchema.parse({
        requirement_id: '11111111-1111-4111-8111-111111111111',
        listing_id: '22222222-2222-4222-8222-222222222222',
      }),
    ).toThrow();
  });
});
