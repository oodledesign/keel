import { describe, expect, it } from 'vitest';

import {
  type RightmoveMapperListing,
  asOptionalNumber,
  mapListingToRightmovePayload,
  mapSectorToSubType,
} from '../rightmove-mapper';

function baseListing(
  overrides: Partial<RightmoveMapperListing> = {},
): RightmoveMapperListing {
  return {
    id: '1a5b7dbb-89a3-401e-b7c2-15a2c21972d4',
    name: '4B Valley Industries, Tonbridge',
    addressLine1: '4B Valley Industries',
    addressLine2: 'Cuckoo Lane',
    town: 'Tonbridge',
    postcode: 'TN11 0AG',
    latitude: 51.217228469899,
    longitude: 0.31167038063432,
    sector: 'Industrial/Logistics',
    tenure: 'New Lease',
    disposalType: 'to_let',
    status: 'marketing',
    askingRentPence: 2_550_000,
    askingPricePence: null,
    rentFrequency: 'per_annum',
    hideRentFromMarketing: true,
    hidePriceFromMarketing: false,
    sizeMinSqft: 1776,
    sizeMaxSqft: 1776,
    measurementStandard: 'gia',
    useClass: null,
    availableFrom: null,
    epcRating: null,
    breeamRating: null,
    summary: 'Industrial unit to let',
    description: 'A modern industrial unit.',
    keyPoints: ['Secure Estate'],
    referenceNumber: null,
    ...overrides,
  };
}

describe('asOptionalNumber', () => {
  it('coerces Postgres numeric strings', () => {
    expect(asOptionalNumber('1776')).toBe(1776);
    expect(asOptionalNumber('1776.5')).toBe(1776.5);
    expect(asOptionalNumber(1776)).toBe(1776);
    expect(asOptionalNumber(null)).toBeNull();
    expect(asOptionalNumber('')).toBeNull();
    expect(asOptionalNumber('nope')).toBeNull();
  });
});

describe('mapSectorToSubType', () => {
  it('maps Industrial/Logistics to LIGHT_INDUSTRIAL', () => {
    expect(mapSectorToSubType('Industrial/Logistics')).toBe('LIGHT_INDUSTRIAL');
  });
});

describe('mapListingToRightmovePayload', () => {
  it('emits numeric sizing when sizes arrive as numeric strings', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        // Simulate PostgREST numeric → string
        sizeMinSqft: '1776' as unknown as number,
        sizeMaxSqft: '1776' as unknown as number,
      }),
      agentId: 283634,
    });

    expect(payload.building.sizing).toEqual({
      size: 1776,
      unit: 'SQFT',
      measurementType: 'GIA',
    });
    expect(typeof payload.building.sizing?.size).toBe('number');
  });

  it('maps New Lease tenure and POA rent', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing(),
      agentId: 283634,
    });

    expect(payload.building.tenureType).toBe('LEASEHOLD');
    expect(payload.building.pricing).toEqual({
      price: 25500,
      displayQualifier: 'PRICE_ON_APPLICATION',
      frequency: 'YEARLY',
    });
    expect(payload.building.primaryPropertyClassification.subType).toBe(
      'LIGHT_INDUSTRIAL',
    );
  });
});
