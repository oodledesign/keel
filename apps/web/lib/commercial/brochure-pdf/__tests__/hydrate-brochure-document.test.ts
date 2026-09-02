import { describe, expect, it } from 'vitest';

import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';
import type { BrochureListing } from '~/lib/commercial/public-brochure.shared';

import type { BrochureDocument } from '../brochure-document';
import { buildBrochureDocument } from '../build-brochure-document';
import { hydrateBrochureDocument } from '../hydrate-brochure-document';

function listing(): BrochureListing {
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
    keyPoints: ['Private entrance'],
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
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        mediaType: 'image',
        url: 'https://cdn.example.com/cover.jpg',
        fileName: 'cover.jpg',
        isCover: true,
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        mediaType: 'image',
        url: 'https://cdn.example.com/int-1.jpg',
        fileName: 'int-1.jpg',
        isCover: false,
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        mediaType: 'image',
        url: 'https://cdn.example.com/int-2.jpg',
        fileName: 'int-2.jpg',
        isCover: false,
      },
    ],
    floorplans: [],
    branch: {
      name: 'Tunbridge Wells',
      address: '27/29 High Street',
      phone: '01892 526111',
      email: 'info@bracketts.co.uk',
      shopfrontUrl: 'https://cdn.example.com/shopfront.jpg',
    },
    nearbyAmenities: [
      { label: 'Crowborough town centre', index: 1 },
      { label: 'Lidl · 0.2 mi', index: 2 },
      { label: 'Morrisons · 0.3 mi', index: 3 },
    ],
    ...overrides,
  };
}

function imageUrl(
  slots: BrochureDocument['pages'][number]['slots'],
  key: string,
): string | null {
  const slot = slots[key];
  return slot?.type === 'image' ? slot.url : null;
}

describe('hydrateBrochureDocument', () => {
  it('fills a null cover hero from the listing cover photo', () => {
    const data = brochureData();
    const built = buildBrochureDocument(data, {
      orientation: 'landscape',
      templateId: 'classic',
    });
    const blankHero = {
      ...built,
      pages: built.pages.map((page) =>
        page.layoutId === 'cover_hero_band'
          ? {
              ...page,
              slots: {
                ...page.slots,
                hero: { type: 'image' as const, mediaId: null, url: null },
              },
            }
          : page,
      ),
    };

    const hydrated = hydrateBrochureDocument(blankHero, data);
    const cover = hydrated.pages.find(
      (page) => page.layoutId === 'cover_hero_band',
    );
    expect(imageUrl(cover!.slots, 'hero')).toBe(
      'https://cdn.example.com/cover.jpg',
    );
  });

  it('fills empty landscape photo slots from current listing media', () => {
    const data = brochureData();
    const saved: BrochureDocument = {
      listingId: data.listing.id,
      templateId: 'classic',
      pageSize: 'A4',
      orientation: 'landscape',
      pages: [
        {
          id: 'cover',
          layoutId: 'cover_hero_band',
          slots: {
            hero: { type: 'image', mediaId: null, url: null },
          },
        },
        {
          id: 'p1',
          layoutId: 'photo_full',
          slots: {
            photo: { type: 'image', mediaId: null, url: null },
          },
        },
        {
          id: 'p2',
          layoutId: 'photo_full',
          slots: {
            photo: { type: 'image', mediaId: null, url: null },
          },
        },
        {
          id: 'map',
          layoutId: 'map_amenities',
          slots: {
            map: {
              type: 'map',
              latitude: 51.058,
              longitude: 0.163,
              amenities: [{ label: 'Crowborough town centre', index: 1 }],
            },
          },
        },
      ],
    };

    const hydrated = hydrateBrochureDocument(saved, data);
    const photos = hydrated.pages.filter((page) =>
      page.layoutId.startsWith('photo_'),
    );
    expect(photos.length).toBe(2);
    expect(photos.every((page) => imageUrl(page.slots, 'photo'))).toBe(true);
    expect(imageUrl(photos[0]!.slots, 'photo')).toBe(
      'https://cdn.example.com/int-1.jpg',
    );

    const map = hydrated.pages.find(
      (page) => page.layoutId === 'map_amenities',
    );
    expect(
      map?.slots.map?.type === 'map' ? map.slots.map.amenities : [],
    ).toEqual([
      { label: 'Crowborough town centre', index: 1 },
      { label: 'Lidl · 0.2 mi', index: 2 },
      { label: 'Morrisons · 0.3 mi', index: 3 },
    ]);
  });

  it('re-resolves a saved mediaId to the current signed URL', () => {
    const data = brochureData();
    const saved: BrochureDocument = {
      listingId: data.listing.id,
      templateId: 'classic',
      pageSize: 'A4',
      orientation: 'landscape',
      pages: [
        {
          id: 'cover',
          layoutId: 'cover_hero_band',
          slots: {
            hero: {
              type: 'image',
              mediaId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              url: 'https://cdn.example.com/expired-signed.jpg',
            },
          },
        },
      ],
    };

    const hydrated = hydrateBrochureDocument(saved, data);
    expect(imageUrl(hydrated.pages[0]!.slots, 'hero')).toBe(
      'https://cdn.example.com/cover.jpg',
    );
  });
});
