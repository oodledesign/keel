import { describe, expect, it } from 'vitest';

import {
  type RightmoveMapperListing,
  annualChargeFromPerSqft,
  asOptionalNumber,
  mapCondition,
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
    letType: null,
    letContractLengthMonths: null,
    epcRating: null,
    breeamRating: null,
    summary: 'Industrial unit to let',
    description: 'A modern industrial unit.',
    keyPoints: ['Secure Estate'],
    referenceNumber: null,
    serviceChargePerSqft: null,
    ratesPayablePerSqft: null,
    conditionDescription: null,
    fittedSpace: null,
    parkingAvailable: false,
    parkingSpaces: null,
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
        order: 1,
        description: 'brochure.pdf',
      },
    ]);
  });

  it('assigns unique 1-based order within each media type', () => {
    const media = mapListingMediaToRightmove([
      {
        mediaType: 'epc',
        mimeType: 'application/pdf',
        fileName: 'epc-a.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/epc.pdf',
        sortOrder: 0,
        isCover: false,
      },
      {
        mediaType: 'epc',
        mimeType: 'application/pdf',
        fileName: 'epc-b.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/epc.pdf',
        sortOrder: 0,
        isCover: false,
      },
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure-a.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/cccccccc-cccc-cccc-cccc-cccccccccccc/brochure.pdf',
        sortOrder: 0,
        isCover: false,
      },
      {
        mediaType: 'brochure',
        mimeType: 'application/pdf',
        fileName: 'brochure-b.pdf',
        url: 'https://app.ozer.so/api/commercial/listing-media/dddddddd-dddd-dddd-dddd-dddddddddddd/brochure.pdf',
        sortOrder: 0,
        isCover: false,
      },
    ]);

    expect(media?.epcs?.map((a) => a.order)).toEqual([1, 2]);
    expect(media?.brochures?.map((a) => a.order)).toEqual([1, 2]);
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

  it('maps service charge and rates from £/sqft × size to annual totals', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        serviceChargePerSqft: 4.5,
        ratesPayablePerSqft: 8.25,
        fittedSpace: true,
        hideRentFromMarketing: false,
      }),
      agentId: 283634,
    });

    expect(payload.building.serviceCharge).toBe(7992);
    expect(payload.building.businessRates).toBe(14652);
    expect(payload.building.condition).toBe('FULL_FIT_OUT');
  });

  it('maps parking toggle and space count for Rightmove ADF', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        parkingAvailable: true,
        parkingSpaces: 24,
      }),
      agentId: 283634,
    });

    expect(payload.building.amenities).toEqual(['PARKING']);
    expect(payload.building.parkingSpaces).toBe(24);
  });

  it('omits parking fields when parking is not available', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        parkingAvailable: false,
        parkingSpaces: 10,
      }),
      agentId: 283634,
    });

    expect(payload.building.amenities).toBeUndefined();
    expect(payload.building.parkingSpaces).toBeUndefined();
  });

  it('maps let type and contract length for lettings', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        disposalType: 'to_let',
        letType: 'LONG',
        letContractLengthMonths: 60,
      }),
      agentId: 283634,
    });

    expect(payload.building.letType).toBe('LONG');
    expect(payload.building.letContractLength).toBe(60);
  });

  it('omits let terms for sale-only disposals', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        disposalType: 'for_sale',
        letType: 'LONG',
        letContractLengthMonths: 60,
      }),
      agentId: 283634,
    });

    expect(payload.building.letType).toBeUndefined();
    expect(payload.building.letContractLength).toBeUndefined();
  });

  it('maps unit rent, description, charges and status onto spaces', () => {
    const { payload } = mapListingToRightmovePayload({
      listing: baseListing({
        hideRentFromMarketing: false,
        askingRentPence: null,
        serviceChargePerSqft: 2,
        ratesPayablePerSqft: 3,
      }),
      agentId: 283634,
      units: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          label: 'Unit 1',
          floorOrUnit: 'Ground',
          sizeSqft: 1000,
          measurementStandard: 'gia',
          sortOrder: 0,
          externalId: null,
          askingRentPence: 1_500_000,
          rentPerSqft: null,
          description: 'Ground floor warehouse bay.',
          sector: 'Industrial / Warehouse',
          status: 'Available',
          serviceChargePerSqft: 5,
          ratesPayablePerSqft: null,
          fittedSpace: false,
        },
      ],
    });

    expect('spaces' in payload.building).toBe(true);
    if (!('spaces' in payload.building)) return;

    const space = payload.building.spaces[0];
    expect(space?.description).toBe('Ground floor warehouse bay.');
    expect(space?.pricing).toEqual({
      price: 15000,
      frequency: 'YEARLY',
    });
    expect(space?.serviceCharge).toBe(5000);
    expect(space?.businessRates).toBe(3000);
    expect(space?.condition).toBe('SHELL_SPACE');
    expect(space?.status).toBe('AVAILABLE');
    expect(space?.primaryPropertyClassification.subType).toBe('WAREHOUSE');
  });
});

describe('annualChargeFromPerSqft', () => {
  it('returns undefined without rate or size', () => {
    expect(annualChargeFromPerSqft(null, 1000)).toBeUndefined();
    expect(annualChargeFromPerSqft(4.5, null)).toBeUndefined();
    expect(annualChargeFromPerSqft(4.5, 1776)).toBe(7992);
  });
});

describe('mapCondition', () => {
  it('prefers fittedSpace over free text', () => {
    expect(mapCondition({ fittedSpace: true })).toBe('FULL_FIT_OUT');
    expect(mapCondition({ fittedSpace: false })).toBe('SHELL_SPACE');
    expect(
      mapCondition({ conditionDescription: 'Partial fit-out remaining' }),
    ).toBe('PARTIAL_FIT_OUT');
  });
});
