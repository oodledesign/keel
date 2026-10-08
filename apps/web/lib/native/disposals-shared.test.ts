import { describe, expect, it } from 'vitest';

import type { CommercialListing } from '~/home/[account]/listings/_lib/server/listings.service';

import {
  NativeDisposalPatchSchema,
  mapNativeDisposal,
  mapNativeDisposalDetail,
  nativeDisposalFilterStatuses,
  nativeDisposalPriceLabel,
  nativeDisposalRentLabel,
  nativeDisposalSizeLabel,
  parseNativeDisposalId,
  parseNativeDisposalListFilter,
  toListingUpdateInput,
  workspaceShowsNativeDisposals,
} from './disposals-shared';
import { NativeHttpError } from './http';

function listing(
  overrides: Partial<CommercialListing> = {},
): CommercialListing {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    accountId: '22222222-2222-4222-8222-222222222222',
    name: '  Unit 4, Riverside  ',
    addressLine1: 'Riverside Way',
    addressLine2: null,
    town: 'Tonbridge',
    county: 'Kent',
    postcode: 'TN9 1AA',
    sector: 'Industrial / Warehouse',
    tenure: 'Leasehold',
    disposalType: 'to_let',
    status: 'marketing',
    askingRentPence: 2_500_000,
    askingRentToPence: null,
    rentFrequency: 'per_annum',
    askingPricePence: null,
    askingPriceQualifier: 'none',
    sizeMinSqft: 1200,
    sizeMaxSqft: 3400,
    useClass: 'CLASS_B8',
    availableFrom: '2026-11-01',
    epcBand: 'B',
    epcRating: 42,
    serviceChargePerSqft: 1.5,
    ratesPayablePerSqft: null,
    summary: 'Modern warehouse',
    description: '',
    notes: 'Landlord flexible',
    keyPoints: [' Yard ', ''],
    onMarketAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    coverUrl: 'https://example.com/cover.jpg',
    actingAgents: [
      {
        userId: 'u1',
        name: 'Dan Potter',
        email: null,
        pictureUrl: null,
        sortOrder: 0,
      },
    ],
    ...overrides,
  } as CommercialListing;
}

describe('workspaceShowsNativeDisposals', () => {
  it('is commercial property only', () => {
    expect(workspaceShowsNativeDisposals('commercial_property')).toBe(true);
    expect(workspaceShowsNativeDisposals('work_design')).toBe(false);
    expect(workspaceShowsNativeDisposals('personal')).toBe(false);
    expect(workspaceShowsNativeDisposals(null)).toBe(false);
  });
});

describe('parseNativeDisposalListFilter', () => {
  it('defaults to live and maps filters to statuses', () => {
    expect(parseNativeDisposalListFilter(null)).toBe('live');
    expect(parseNativeDisposalListFilter(' Completed ')).toBe('completed');
    expect(nativeDisposalFilterStatuses('live')).toEqual([
      'draft',
      'instructed',
      'marketing',
      'under_offer',
    ]);
    expect(nativeDisposalFilterStatuses('completed')).toEqual(['let', 'sold']);
    expect(nativeDisposalFilterStatuses('all')).toEqual([]);
  });

  it('rejects unknown filters', () => {
    expect(() => parseNativeDisposalListFilter('archived')).toThrow(
      NativeHttpError,
    );
  });
});

describe('parseNativeDisposalId', () => {
  it('404s on non-uuid ids', () => {
    expect(() => parseNativeDisposalId('nope')).toThrow(NativeHttpError);
    expect(parseNativeDisposalId(listing().id)).toBe(listing().id);
  });
});

describe('labels', () => {
  it('formats size ranges and single sizes', () => {
    expect(nativeDisposalSizeLabel(1200, 3400)).toBe('1,200–3,400 sq ft');
    expect(nativeDisposalSizeLabel(null, 900)).toBe('900 sq ft');
    expect(nativeDisposalSizeLabel(0, null)).toBeNull();
  });

  it('keeps pence on per-sq-ft rents and suffixes the frequency', () => {
    expect(nativeDisposalRentLabel(150, 300, 'per_sqft')).toBe(
      '£1.50–£3.00 per sq ft',
    );
    expect(nativeDisposalRentLabel(1300, 1300, 'per_sqft')).toBe(
      '£13.00 per sq ft',
    );
    expect(nativeDisposalRentLabel(250_000, null, 'per_month')).toBe(
      '£2,500 pcm',
    );
    expect(nativeDisposalRentLabel(2_500_000, null, null)).toBe('£25,000 pa');
    expect(nativeDisposalRentLabel(null, 0, 'per_annum')).toBeNull();
  });

  it('prefixes qualified prices', () => {
    expect(nativeDisposalPriceLabel(150_000_000, 'none')).toBe('£1,500,000');
    expect(nativeDisposalPriceLabel(150_000_000, 'guide_price')).toBe(
      'Guide Price £1,500,000',
    );
    expect(nativeDisposalPriceLabel(null, 'none')).toBeNull();
  });
});

describe('mapNativeDisposal', () => {
  it('maps a list row', () => {
    expect(mapNativeDisposal(listing())).toEqual({
      id: listing().id,
      name: 'Unit 4, Riverside',
      address: 'Riverside Way, Tonbridge, TN9 1AA',
      postcode: 'TN9 1AA',
      status: 'marketing',
      status_label: 'Marketing',
      disposal_type: 'to_let',
      disposal_type_label: 'To let',
      sector: 'Industrial / Warehouse',
      size_label: '1,200–3,400 sq ft',
      rent_label: '£25,000 pa',
      price_label: null,
      cover_url: 'https://example.com/cover.jpg',
      agents: ['Dan Potter'],
      updated_at: '2026-10-01T09:00:00Z',
    });
  });

  it('maps detail fields and blanks empty text', () => {
    const detail = mapNativeDisposalDetail(listing(), false);
    expect(detail.description).toBeNull();
    expect(detail.key_points).toEqual(['Yard']);
    expect(detail.use_class_label).toBe('Class B8 – Storage or distribution');
    expect(detail.available_from).toBe('2026-11-01');
    expect(detail.can_edit).toBe(false);
  });
});

describe('NativeDisposalPatchSchema', () => {
  it('requires at least one field', () => {
    expect(NativeDisposalPatchSchema.safeParse({}).success).toBe(false);
  });

  it('rejects min size above max size', () => {
    expect(
      NativeDisposalPatchSchema.safeParse({
        size_min_sqft: 5000,
        size_max_sqft: 1000,
      }).success,
    ).toBe(false);
  });

  it('maps to service input, leaving omitted keys undefined', () => {
    const parsed = NativeDisposalPatchSchema.parse({
      status: 'under_offer',
      asking_rent_pence: null,
      summary: '  ',
      available_from: '2026-12-01',
    });
    expect(toListingUpdateInput(parsed)).toEqual({
      name: undefined,
      status: 'under_offer',
      askingRentPence: null,
      askingRentToPence: undefined,
      rentFrequency: undefined,
      askingPricePence: undefined,
      askingPriceQualifier: undefined,
      sizeMinSqft: undefined,
      sizeMaxSqft: undefined,
      availableFrom: '2026-12-01',
      summary: null,
      description: undefined,
      notes: undefined,
    });
  });

  it('rejects malformed dates and unknown statuses', () => {
    expect(
      NativeDisposalPatchSchema.safeParse({ available_from: '01/12/2026' })
        .success,
    ).toBe(false);
    expect(
      NativeDisposalPatchSchema.safeParse({ status: 'archived' }).success,
    ).toBe(false);
  });
});
