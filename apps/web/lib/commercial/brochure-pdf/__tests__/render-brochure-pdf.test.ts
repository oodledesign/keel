import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';

import type {
  BrochureDocument,
  BrochureRenderWarning,
} from '../brochure-document';
import { createBlankBrochurePage } from '../build-brochure-document';
import { renderBrochurePdf } from '../render-brochure-pdf';

vi.mock('server-only', () => ({}));

const data = {
  token: '',
  listing: {
    id: '33dde750-8324-46b7-9913-4b0685e3f3fd',
    accountId: 'c4e7c6b1-e4f0-43ee-a768-6b3782e50d62',
    name: '176 Tonbridge Road',
    addressLine1: '176 Tonbridge Road',
    addressLine2: null,
    town: 'Maidstone',
    county: 'Kent',
    postcode: 'ME16 8SR',
    latitude: null,
    longitude: null,
    disposalType: 'to_let',
    tenure: 'Leasehold',
    useClass: 'E',
    askingRentPence: null,
    askingRentToPence: null,
    askingPricePence: null,
    rentFrequency: 'pa',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    serviceChargePerSqft: null,
    ratesPayablePerSqft: null,
    estateChargePerSqft: null,
    sizeMinSqft: null,
    sizeMaxSqft: null,
    epcBand: null,
    epcRating: null,
    availableFrom: null,
    summary: null,
    description: null,
    locationCopy: null,
    keyPoints: [],
  },
  accountName: 'Bracketts',
  brand: {
    logoUrl: null,
    primaryColor: '#0D2344',
    secondaryColor: '#FFFFFF',
    accentColor: '#C8102E',
  },
  agents: [],
  images: [],
  floorplans: [],
  branch: null,
} as unknown as PublicBrochureData;

function document(): BrochureDocument {
  const pages = (['location_text', 'photo_grid_4', 'photo_text'] as const).map(
    (layoutId) => ({
      ...createBlankBrochurePage(layoutId),
      id: layoutId,
    }),
  );
  return {
    listingId: data.listing.id,
    templateId: 'classic',
    orientation: 'landscape',
    pageSize: 'A4',
    pages,
  };
}

describe('renderBrochurePdf', () => {
  it('renders every page of the document', async () => {
    const bytes = await renderBrochurePdf(document(), data);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  }, 30_000);

  it('renders only the requested pages', async () => {
    const warnings: BrochureRenderWarning[] = [];
    const bytes = await renderBrochurePdf(document(), data, {
      warnings,
      pageIds: ['photo_text'],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.pageId === 'photo_text')).toBe(true);
    expect(warnings[0]?.pageNumber).toBe(3);
  }, 30_000);

  it('warns when more places are entered than a page shows', async () => {
    const places = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        label: `Place ${i + 1} · 0.${i + 1} mi`,
        index: i + 1,
      }));
    const cut = async (count: number, limit?: number) => {
      const base = createBlankBrochurePage('location_text');
      const warnings: BrochureRenderWarning[] = [];
      await renderBrochurePdf(
        {
          ...document(),
          pages: [
            {
              ...base,
              id: 'location',
              slots: {
                ...base.slots,
                map: {
                  type: 'map',
                  latitude: null,
                  longitude: null,
                  amenities: places(count),
                  limit,
                },
              },
            },
          ],
        },
        data,
        { warnings },
      );
      return warnings.some((w) => w.kind === 'places_cut');
    };

    expect(await cut(10)).toBe(true);
    expect(await cut(8)).toBe(false);
    expect(await cut(10, 5)).toBe(false);
  }, 30_000);
});
