import { describe, expect, it } from 'vitest';

import type {
  BrochureListing,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

import { DEFAULT_BROCHURE_DISPLAY_OPTIONS } from '../brochure-document';
import {
  buildAmenities,
  buildBrochureDocument,
  coverSlots,
} from '../build-brochure-document';
import { brochureSashHex, buildCoverPriceLines } from '../cover-prices';

function listing(overrides: Partial<BrochureListing> = {}): BrochureListing {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    name: 'Lower Ground Floor, 4 London Road',
    addressLine1: 'Lower Ground Floor, 4 London Road',
    addressLine2: null,
    town: 'Crowborough',
    county: 'East Sussex',
    postcode: 'TN6 2TT',
    latitude: 51.058,
    longitude: 0.163,
    disposalType: 'to_let_and_for_sale',
    tenure: 'Leasehold',
    useClass: 'E',
    askingRentPence: 840_000,
    askingRentToPence: null,
    askingPricePence: 9_000_000,
    rentFrequency: 'pa',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    serviceChargePerSqft: null,
    ratesPayablePerSqft: null,
    estateChargePerSqft: null,
    sizeMinSqft: 821,
    sizeMaxSqft: 821,
    epcBand: null,
    epcRating: null,
    availableFrom: null,
    summary: 'Ground-floor retail.',
    description: 'A compact lock-up shop in Crowborough town centre.',
    locationCopy: null,
    keyPoints: ['Town centre', 'New lease'],
    ...overrides,
  };
}

function brochureData(
  overrides: Partial<PublicBrochureData> = {},
): PublicBrochureData {
  return {
    token: '',
    listing: listing(),
    accountName: 'Bracketts',
    brand: {
      logoUrl: null,
      primaryColor: '#0D2344',
      secondaryColor: '#FFFFFF',
      accentColor: '#C8102E',
    },
    agents: [],
    images: [
      {
        id: 'cover',
        mediaType: 'image',
        url: 'https://cdn.example.com/cover.jpg',
        fileName: 'cover.jpg',
        isCover: true,
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `img-${i + 1}`,
        mediaType: 'image' as const,
        url: `https://cdn.example.com/int-${i + 1}.jpg`,
        fileName: `int-${i + 1}.jpg`,
        isCover: false,
      })),
    ],
    floorplans: [],
    branch: {
      name: 'Tunbridge Wells',
      address: '27/29 High Street, Tunbridge Wells, Kent, TN1 1UU',
      phone: '01892 526111',
      email: 'info@bracketts.co.uk',
    },
    ...overrides,
  };
}

function text(
  slots: Record<string, { type: string; text?: string }>,
  key: string,
): string {
  const slot = slots[key];
  return slot?.type === 'text' ? (slot.text ?? '') : '';
}

describe('buildCoverPriceLines', () => {
  it('stacks size, rent and price as separate lines without a middle-dot join', () => {
    const lines = buildCoverPriceLines(
      listing(),
      DEFAULT_BROCHURE_DISPLAY_OPTIONS,
    );
    expect(lines).toEqual(['821 sq ft', '£8,400 pa', '£90,000']);
    expect(lines.join(' ')).not.toContain('·');
  });

  it('uses a strong red sash when the brand accent is too dark', () => {
    expect(brochureSashHex('#0D2344')).toBe('#C8102E');
    expect(brochureSashHex('#FF5C34')).toBe('#FF5C34');
  });

  it('omits a line when the matching display toggle is off', () => {
    const lines = buildCoverPriceLines(listing(), {
      ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
      showRent: false,
    });
    expect(lines).toEqual(['821 sq ft', '£90,000']);
  });
});

describe('coverSlots', () => {
  it('keeps the full address and newline-stacked headline', () => {
    const slots = coverSlots(brochureData(), DEFAULT_BROCHURE_DISPLAY_OPTIONS);
    expect(text(slots, 'address')).toBe(
      'Lower Ground Floor, 4 London Road, Crowborough, East Sussex, TN6 2TT',
    );
    expect(text(slots, 'address')).not.toContain('…');
    expect(text(slots, 'headline')).toBe('821 sq ft\n£8,400 pa\n£90,000');
    expect(text(slots, 'headline')).not.toContain('·');
    expect(text(slots, 'size')).toBe('821 sq ft');
    expect(text(slots, 'rent')).toBe('£8,400 pa');
    expect(text(slots, 'price')).toBe('£90,000');
    expect(text(slots, 'reducedBadge')).toBe('');
  });

  it('bakes a reduced-price badge when the display option is on', () => {
    const slots = coverSlots(brochureData(), {
      ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
      showReducedPrice: true,
    });
    expect(text(slots, 'reducedBadge')).toBe('REDUCED PRICE');
  });
});

describe('buildAmenities', () => {
  it('never prints a dummy Local area (outward postcode) line', () => {
    const amenities = buildAmenities(brochureData());
    expect(amenities.map((item) => item.label)).toEqual([
      'Crowborough town centre',
    ]);
    expect(amenities.some((item) => /local area\s*\(/i.test(item.label))).toBe(
      false,
    );
  });

  it('uses fetched nearby labels when provided', () => {
    const amenities = buildAmenities(
      brochureData({
        nearbyAmenities: [
          { label: 'Crowborough station · 0.4 mi', index: 1 },
          { label: 'Waitrose · 0.2 mi', index: 2 },
        ],
      }),
    );
    expect(amenities.map((item) => item.label)).toEqual([
      'Crowborough station · 0.4 mi',
      'Waitrose · 0.2 mi',
    ]);
  });

  it('strips dummy Local area labels from fetched data', () => {
    const amenities = buildAmenities(
      brochureData({
        nearbyAmenities: [{ label: 'Local area (TN6)', index: 1 }],
      }),
    );
    expect(amenities.map((item) => item.label)).toEqual([
      'Crowborough town centre',
    ]);
  });
});

describe('buildBrochureDocument', () => {
  it('includes branch text on the contact page even with zero agents', () => {
    const doc = buildBrochureDocument(brochureData(), {
      orientation: 'landscape',
      templateId: 'classic',
    });
    const contact = doc.pages.find((page) => page.layoutId === 'contact');
    expect(contact).toBeTruthy();
    expect(text(contact!.slots, 'branchAddress')).toContain(
      '27/29 High Street, Tunbridge Wells, Kent, TN1 1UU',
    );
    expect(text(contact!.slots, 'branchPhone')).toBe('01892 526111');
    expect(text(contact!.slots, 'branchEmail')).toBe('info@bracketts.co.uk');
  });

  it('packs landscape classic interiors into photo_grid_2 instead of full-bleed pages', () => {
    const doc = buildBrochureDocument(brochureData(), {
      orientation: 'landscape',
      templateId: 'classic',
    });
    const photoLayouts = doc.pages
      .filter((page) => page.layoutId.startsWith('photo_'))
      .map((page) => page.layoutId);

    expect(photoLayouts).toContain('photo_grid_2');
    expect(
      photoLayouts.filter((id) => id === 'photo_full').length,
    ).toBeLessThan(5);
  });
});
