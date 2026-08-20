import { describe, expect, it } from 'vitest';

import {
  type RightmoveMapperListing,
  asOptionalNumber,
  mapListingMediaToRightmove,
  mapListingToRightmovePayload,
  mapSectorToSubType,
  mapUseClasses,
  roundCoordinate,
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

describe('roundCoordinate', () => {
  it('rounds to at most 6 decimal places', () => {
    expect(roundCoordinate(0.31167038063432)).toBe(0.31167);
    expect(roundCoordinate(51.217228469899)).toBe(51.217228);
    expect(roundCoordinate(null)).toBeNull();
  });
});

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

describe('mapUseClasses', () => {
  it('maps descriptive Class E strings to CLASS_E', () => {
    expect(mapUseClasses('Class E - Commercial, Business and Service')).toEqual(
      ['CLASS_E'],
    );
    expect(mapUseClasses('CLASS_E_-_COMMERCIAL')).toEqual(['CLASS_E']);
  });

  it('maps mixed industrial classes without descriptions', () => {
    expect(mapUseClasses('E / B2 / B8')).toEqual([
      'CLASS_E',
      'CLASS_B2',
      'CLASS_B8',
    ]);
  });

  it('maps Class B2 and Class E in one permitted-use string', () => {
    expect(
      mapUseClasses(
        'Class B2 - General Industrial, Class E - Commercial, Business and Service',
      ),
    ).toEqual(['CLASS_B2', 'CLASS_E']);
  });

  it('omits values that are not in the Rightmove enum', () => {
    expect(mapUseClasses('unknown')).toBeUndefined();
    expect(mapUseClasses(null)).toBeUndefined();
  });

  it('maps sui generis', () => {
    expect(mapUseClasses('Sui Generis')).toEqual(['SUI_GENERIS']);
  });
});

describe('mapListingMediaToRightmove', () => {
  it('keeps short brochure .pdf URLs and drops overlong signed URLs', () => {
    const longSigned = `https://example.supabase.co/storage/v1/object/sign/commercial-listing-media/path/brochure.pdf?token=${'a'.repeat(300)}`;
    const shortProxy =
      'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.pdf';

    const media = mapListingMediaToRightmove([
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: longSigned,
        sortOrder: 0,
        isCover: false,
      },
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: shortProxy,
        sortOrder: 1,
        isCover: false,
      },
    ]);

    expect(media?.brochures).toEqual([
      {
        url: shortProxy,
        order: 1,
        description: 'brochure.pdf',
      },
    ]);
  });

  it('rejects brochure URLs that do not end with .pdf', () => {
    const media = mapListingMediaToRightmove([
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: 'https://cdn.example/files/brochure?id=1',
        sortOrder: 0,
        isCover: false,
      },
    ]);
    expect(media?.brochures).toBeUndefined();
  });

  it('rejects brochure URLs with query strings or dotted cache-bust stems', () => {
    const media = mapListingMediaToRightmove([
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.pdf?v=1',
        sortOrder: 0,
        isCover: false,
      },
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure.v1.pdf',
        sortOrder: 1,
        isCover: false,
      },
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure-v1.pdf',
        sortOrder: 2,
        isCover: false,
      },
    ]);
    expect(media?.brochures).toEqual([
      {
        url: 'https://app.ozer.so/api/commercial/listing-media/702cafa5-a1bf-4a80-b7be-f498fbc52f33/brochure-v1.pdf',
        order: 2,
        description: 'brochure.pdf',
      },
    ]);
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

  it('rounds coordinates to 6 decimal places for ADF', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        latitude: 51.217228469899,
        longitude: 0.31167038063432,
      }),
      agentId: 283634,
    });

    expect(payload.building.location.latitude).toBe(51.217228);
    expect(payload.building.location.longitude).toBe(0.31167);
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

  it('emits a valid Rightmove useClasses enum for descriptive Class E', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        useClass: 'Class E - Commercial, Business and Service',
      }),
      agentId: 283634,
    });

    expect(payload.building.useClasses).toEqual(['CLASS_E']);
  });
});
