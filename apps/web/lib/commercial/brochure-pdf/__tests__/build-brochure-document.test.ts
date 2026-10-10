import { describe, expect, it } from 'vitest';

import type {
  BrochureListing,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

import { DEFAULT_BROCHURE_DISPLAY_OPTIONS } from '../brochure-document';
import {
  brochureRentValue,
  brochureSizeValue,
  buildAmenities,
  buildBrochureDocument,
  buildDetailsBody,
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
      shopfrontUrl: null,
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
  it('defaults website and slideshow brochure buttons on', () => {
    expect(DEFAULT_BROCHURE_DISPLAY_OPTIONS.showWebsiteListingButton).toBe(
      true,
    );
    expect(DEFAULT_BROCHURE_DISPLAY_OPTIONS.showSlideshowBrochureButton).toBe(
      true,
    );
  });

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

  it('bakes the branch shopfront URL into the contact page slot', () => {
    const doc = buildBrochureDocument(
      brochureData({
        branch: {
          name: 'Tunbridge Wells',
          address: '27/29 High Street, Tunbridge Wells, Kent, TN1 1UU',
          phone: '01892 526111',
          email: 'info@bracketts.co.uk',
          shopfrontUrl: 'https://cdn.example.com/shopfront.jpg',
        },
      }),
      {
        orientation: 'landscape',
        templateId: 'classic',
      },
    );
    const contact = doc.pages.find((page) => page.layoutId === 'contact');
    const shopfront = contact?.slots.shopfront;
    expect(shopfront).toEqual({
      type: 'image',
      mediaId: null,
      url: 'https://cdn.example.com/shopfront.jpg',
    });
  });

  it('stores key points without hyphen prefixes', () => {
    const doc = buildBrochureDocument(
      brochureData({
        listing: listing({
          description:
            'A compact lock-up shop in Crowborough town centre. '.repeat(20),
        }),
      }),
      {
        orientation: 'landscape',
        templateId: 'classic',
      },
    );
    const description = doc.pages.find(
      (page) => page.layoutId === 'description_highlights',
    );
    expect(text(description!.slots, 'highlights')).toBe(
      'Town centre\nNew lease',
    );
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

  function imageIds(doc: ReturnType<typeof buildBrochureDocument>) {
    return doc.pages.flatMap((page) =>
      Object.values(page.slots).flatMap((slot) =>
        slot.type === 'image' && slot.mediaId ? [slot.mediaId] : [],
      ),
    );
  }

  it('moves a small photo set onto the facts page with no gallery page', () => {
    const data = brochureData({
      images: brochureData().images.slice(0, 3),
    });
    const doc = buildBrochureDocument(data, {
      orientation: 'landscape',
      templateId: 'classic',
    });
    const facts = doc.pages.find((page) => page.layoutId === 'facts_table');
    expect(facts?.slots.photo1).toMatchObject({ mediaId: 'img-1' });
    expect(facts?.slots.photo2).toMatchObject({ mediaId: 'img-2' });
    expect(doc.pages.some((page) => page.layoutId.startsWith('photo_'))).toBe(
      false,
    );
  });

  it('keeps portrait photos in the gallery when the facts page is full', () => {
    const data = brochureData({
      images: brochureData().images.slice(0, 3),
      listing: listing({
        serviceChargePerSqft: 2,
        ratesPayablePerSqft: 5,
        estateChargePerSqft: 1,
        epcBand: 'C',
        epcRating: 51,
        availableFrom: 'Immediately',
        possession: 'On completion',
        parkingSpaces: 4,
        description: 'Prime retail unit. '.repeat(24),
        keyPoints: ['One', 'Two', 'Three', 'Four', 'Five'],
      }),
    });
    const doc = buildBrochureDocument(data, {
      orientation: 'portrait',
      templateId: 'classic',
    });
    const facts = doc.pages.find((page) => page.layoutId === 'facts_table');
    expect(facts?.slots.photo1).toBeUndefined();
    expect(imageIds(doc)).toEqual(expect.arrayContaining(['img-1', 'img-2']));
  });

  it('never places the same photo twice', () => {
    for (const templateId of ['classic', 'compact', 'editorial'] as const) {
      const doc = buildBrochureDocument(brochureData(), {
        orientation: 'portrait',
        templateId,
      });
      const ids = imageIds(doc);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps editorial facts pages text-only', () => {
    const doc = buildBrochureDocument(brochureData(), {
      orientation: 'landscape',
      templateId: 'editorial',
    });
    const facts = doc.pages.find((page) => page.layoutId === 'facts_table');
    expect(facts?.slots.photo1).toBeUndefined();
  });

  it('adds a details page only when there is spec or terms copy', () => {
    const plain = buildBrochureDocument(brochureData(), {
      orientation: 'landscape',
      templateId: 'classic',
    });
    expect(
      plain.pages.some((page) => page.layoutId === 'details_columns'),
    ).toBe(false);

    const rich = buildBrochureDocument(
      brochureData({
        listing: listing({ amenities: ['Air conditioning'], epcBand: 'C' }),
      }),
      { orientation: 'landscape', templateId: 'classic' },
    );
    const details = rich.pages.find(
      (page) => page.layoutId === 'details_columns',
    );
    expect(text(details!.slots, 'epc')).toBe('C');
  });
});

describe('brochure facts values', () => {
  it('says "On application" for a hidden or missing rent on a to-let', () => {
    expect(
      brochureRentValue(listing({ hideRentFromMarketing: true }), {
        ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
        showRent: false,
      }),
    ).toBe('On application');
    expect(
      brochureRentValue(
        listing({ askingRentPence: null }),
        DEFAULT_BROCHURE_DISPLAY_OPTIONS,
      ),
    ).toBe('On application');
    expect(
      brochureRentValue(
        listing({ disposalType: 'for_sale' }),
        DEFAULT_BROCHURE_DISPLAY_OPTIONS,
      ),
    ).toBeNull();
  });

  it('adds sq m and the measurement basis to sizes', () => {
    expect(
      brochureSizeValue(
        listing({
          sizeMinSqft: 72,
          sizeMaxSqft: 1146,
          measurementStandard: 'nia',
        }),
      ),
    ).toBe('72 – 1,146 sq ft (6.7 – 106.5 sq m) NIA');
    expect(
      brochureSizeValue(listing({ sizeMinSqft: null, sizeMaxSqft: null })),
    ).toBeNull();
  });
});

describe('buildDetailsBody', () => {
  it('is empty without spec or marketing sections', () => {
    expect(buildDetailsBody(brochureData())).toBe('');
  });

  it('lists the spec, marketing sections and a default viewing line', () => {
    const body = buildDetailsBody(
      brochureData({
        listing: listing({
          amenities: ['Air conditioning', ' ', 'Kitchen'],
          marketingSections: [
            { kind: 'terms', title: 'Terms', body: 'New FRI lease.' },
          ],
        }),
      }),
    );
    expect(body).toBe(
      [
        '## Specification\n- Air conditioning\n- Kitchen',
        '## Terms\nNew FRI lease.',
        '## Viewing\nStrictly by appointment through Bracketts.',
      ].join('\n\n'),
    );
  });

  it('folds amenities into an existing specification section', () => {
    const body = buildDetailsBody(
      brochureData({
        listing: listing({
          amenities: ['Kitchen'],
          marketingSections: [
            {
              kind: 'specifications',
              title: 'Specification',
              body: 'Refurbished throughout.',
            },
          ],
        }),
      }),
    );
    expect(body.match(/## Specification/g)).toHaveLength(1);
    expect(body).toContain('Refurbished throughout.\n- Kitchen');
  });

  it("keeps the agent's own viewing section", () => {
    const body = buildDetailsBody(
      brochureData({
        listing: listing({
          marketingSections: [
            { kind: 'viewings', title: 'Viewings', body: 'Call the office.' },
          ],
        }),
      }),
    );
    expect(body).toBe('## Viewings\nCall the office.');
  });
});
