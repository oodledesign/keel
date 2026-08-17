import {
  type BrochureDocument,
  type BrochureLayoutId,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureSlotValue,
  type BrochureTemplateId,
  newBrochurePageId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';
import {
  formatBrochureAddress,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
  formatDisposalLabel,
} from '~/lib/commercial/public-brochure.shared';

export type BuildBrochureDocumentOptions = {
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
};

function page(
  layoutId: BrochureLayoutId,
  slots: Record<string, BrochureSlotValue>,
  meta?: { sectionLabel?: string; sectionNumber?: string },
): BrochurePage {
  return {
    id: newBrochurePageId(),
    layoutId,
    sectionLabel: meta?.sectionLabel,
    sectionNumber: meta?.sectionNumber,
    slots,
  };
}

function imageSlot(
  mediaId: string | null,
  url: string | null,
): BrochureSlotValue {
  return { type: 'image', mediaId, url };
}

function textSlot(text: string): BrochureSlotValue {
  return { type: 'text', text };
}

function buildFactsRows(
  data: PublicBrochureData,
): Array<{ label: string; value: string }> {
  const { listing } = data;
  const rows: Array<{ label: string; value: string }> = [];

  rows.push({
    label: 'Disposal',
    value: formatDisposalLabel(listing.disposalType),
  });

  if (listing.tenure?.trim()) {
    rows.push({ label: 'Tenure', value: listing.tenure.trim() });
  }

  const size = formatBrochureSize(listing);
  if (size) rows.push({ label: 'Size', value: size });

  const rent = formatBrochureRent(listing);
  if (rent) rows.push({ label: 'Rent', value: rent });

  const price = formatBrochurePrice(listing);
  if (price) rows.push({ label: 'Price', value: price });

  if (listing.useClass?.trim()) {
    rows.push({ label: 'Use class', value: listing.useClass.trim() });
  }

  const epcParts = [listing.epcBand, listing.epcRating]
    .filter((v) => v != null && String(v).trim() !== '')
    .map(String);
  if (epcParts.length > 0) {
    rows.push({ label: 'EPC', value: epcParts.join(' / ') });
  }

  if (listing.availableFrom?.trim()) {
    rows.push({ label: 'Available', value: listing.availableFrom.trim() });
  }

  return rows;
}

function buildAmenities(data: PublicBrochureData): Array<{
  label: string;
  index: number;
}> {
  const amenities: Array<{ label: string; index: number }> = [];
  const town = data.listing.town?.trim();
  const postcode = data.listing.postcode?.trim();

  if (town) {
    amenities.push({ label: `${town} town centre`, index: 1 });
  }
  if (postcode) {
    amenities.push({
      label: `Local area (${postcode.split(' ')[0] ?? postcode})`,
      index: amenities.length + 1,
    });
  }

  // Pull short location bullets from location copy if present
  const locationBits = (data.listing.locationCopy ?? '')
    .split(/[\n•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 80)
    .slice(0, 4);

  for (const bit of locationBits) {
    if (amenities.length >= 6) break;
    amenities.push({ label: bit, index: amenities.length + 1 });
  }

  if (amenities.length === 0) {
    amenities.push({ label: 'Property location', index: 1 });
  }

  return amenities;
}

function coverSlots(data: PublicBrochureData): Record<string, BrochureSlotValue> {
  const cover =
    data.images.find((i) => i.isCover) ?? data.images[0] ?? null;
  const address = formatBrochureAddress(data.listing);
  const size = formatBrochureSize(data.listing);
  const rent = formatBrochureRent(data.listing);
  const price = formatBrochurePrice(data.listing);
  const priceLine = [size, rent, price].filter(Boolean).join('  ·  ');

  return {
    hero: imageSlot(cover?.id ?? null, cover?.url ?? null),
    title: textSlot(data.listing.name),
    address: textSlot(address || data.listing.name),
    disposal: textSlot(formatDisposalLabel(data.listing.disposalType)),
    headline: textSlot(priceLine),
    brandName: textSlot(data.accountName ?? 'Agency'),
  };
}

function photoPages(
  data: PublicBrochureData,
  templateId: BrochureTemplateId,
): BrochurePage[] {
  // Prefer non-cover for gallery; fall back to remaining images after cover
  const gallery =
    data.images.length > 1
      ? data.images.filter((img) => !img.isCover)
      : data.images.slice(1);

  const pool = gallery.length > 0 ? gallery : data.images.slice(1);
  if (pool.length === 0) return [];

  const pages: BrochurePage[] = [];
  let i = 0;
  let section = 1;

  const preferFullBleed = templateId === 'editorial';

  while (i < pool.length) {
    const remaining = pool.length - i;

    if (preferFullBleed || remaining === 1) {
      const img = pool[i]!;
      pages.push(
        page(
          'photo_full',
          { photo: imageSlot(img.id, img.url) },
          templateId === 'editorial'
            ? {
                sectionNumber: String(section).padStart(2, '0'),
                sectionLabel: 'Photography',
              }
            : undefined,
        ),
      );
      i += 1;
      section += 1;
      continue;
    }

    if (remaining >= 3 && templateId !== 'compact') {
      const a = pool[i]!;
      const b = pool[i + 1]!;
      const c = pool[i + 2]!;
      pages.push(
        page('photo_grid_3', {
          photo1: imageSlot(a.id, a.url),
          photo2: imageSlot(b.id, b.url),
          photo3: imageSlot(c.id, c.url),
        }),
      );
      i += 3;
      continue;
    }

    const a = pool[i]!;
    const b = pool[i + 1]!;
    pages.push(
      page('photo_grid_2', {
        photo1: imageSlot(a.id, a.url),
        photo2: imageSlot(b.id, b.url),
      }),
    );
    i += 2;
  }

  return pages;
}

function floorplanPages(data: PublicBrochureData): BrochurePage[] {
  return data.floorplans.slice(0, 2).map((fp, index) =>
    page(
      'floorplan',
      {
        plan: imageSlot(fp.id, fp.url),
        caption: textSlot(fp.fileName ?? `Floor plan ${index + 1}`),
      },
      { sectionLabel: 'Floor plans' },
    ),
  );
}

/**
 * Build a slot-based brochure document from listing brochure data.
 */
export function buildBrochureDocument(
  data: PublicBrochureData,
  options: BuildBrochureDocumentOptions,
): BrochureDocument {
  const { orientation, templateId } = options;
  const facts = buildFactsRows(data);
  const amenities = buildAmenities(data);
  const description =
    data.listing.description?.trim() ||
    data.listing.summary?.trim() ||
    '';
  const highlights = data.listing.keyPoints.slice(0, 8);
  const locationCopy = data.listing.locationCopy?.trim() ?? '';

  const pages: BrochurePage[] = [];

  // Cover — always
  pages.push(
    page(
      'cover_hero_band',
      coverSlots(data),
      templateId === 'editorial'
        ? { sectionNumber: '01', sectionLabel: 'Cover' }
        : undefined,
    ),
  );

  if (templateId === 'compact') {
    // Short pack: cover, one facts+copy spread feel via facts + description, contact
    if (facts.length > 0) {
      pages.push(
        page('facts_table', {
          facts: { type: 'facts', rows: facts },
          title: textSlot('The offering'),
        }),
      );
    }

    if (description || highlights.length > 0) {
      pages.push(
        page('description_highlights', {
          title: textSlot('Highlights'),
          body: textSlot(description.slice(0, 900)),
          highlights: textSlot(highlights.map((h) => `• ${h}`).join('\n')),
        }),
      );
    }

    const gallery = photoPages(data, templateId).slice(0, 1);
    pages.push(...gallery);

    if (data.listing.latitude != null && data.listing.longitude != null) {
      pages.push(
        page('map_amenities', {
          title: textSlot('Location'),
          body: textSlot(locationCopy.slice(0, 500)),
          map: {
            type: 'map',
            latitude: data.listing.latitude,
            longitude: data.listing.longitude,
            amenities,
          },
        }),
      );
    }

    pages.push(
      page('contact', {
        title: textSlot('Contact'),
        notice: textSlot(
          'Important notice: These particulars are for guidance only and do not constitute any part of an offer or contract. All descriptions, dimensions and other details are given in good faith but should not be relied upon as statements of fact.',
        ),
        agents: { type: 'agents' },
      }),
    );

    return {
      listingId: data.listing.id,
      templateId,
      pageSize: 'A4',
      orientation,
      pages,
      updatedAt: new Date().toISOString(),
    };
  }

  // Classic + Editorial fuller packs
  if (facts.length > 0) {
    pages.push(
      page(
        'facts_table',
        {
          facts: { type: 'facts', rows: facts },
          title: textSlot(
            templateId === 'editorial' ? 'The offering' : 'Summary',
          ),
        },
        templateId === 'editorial'
          ? { sectionNumber: '02', sectionLabel: 'The offering' }
          : undefined,
      ),
    );
  }

  if (description || highlights.length > 0) {
    pages.push(
      page(
        'description_highlights',
        {
          title: textSlot(
            templateId === 'editorial' ? 'Description' : 'About the property',
          ),
          body: textSlot(
            description.slice(0, templateId === 'editorial' ? 700 : 1200),
          ),
          highlights: textSlot(highlights.map((h) => `• ${h}`).join('\n')),
        },
        templateId === 'editorial'
          ? { sectionNumber: '03', sectionLabel: 'Description' }
          : undefined,
      ),
    );
  }

  const galleryLimit = templateId === 'editorial' ? 6 : 4;
  pages.push(...photoPages(data, templateId).slice(0, galleryLimit));

  pages.push(...floorplanPages(data));

  if (data.listing.latitude != null && data.listing.longitude != null) {
    pages.push(
      page(
        'map_amenities',
        {
          title: textSlot('Location'),
          body: textSlot(locationCopy.slice(0, 800)),
          map: {
            type: 'map',
            latitude: data.listing.latitude,
            longitude: data.listing.longitude,
            amenities,
          },
        },
        templateId === 'editorial'
          ? { sectionNumber: '04', sectionLabel: 'Location' }
          : undefined,
      ),
    );
  }

  pages.push(
    page(
      'contact',
      {
        title: textSlot('Contact'),
        notice: textSlot(
          'Important notice: These particulars are believed to be correct but their accuracy is not guaranteed and they do not form part of any contract. Interested parties should satisfy themselves by inspection or otherwise as to the correctness of each statement.',
        ),
        agents: { type: 'agents' },
      },
      templateId === 'editorial'
        ? { sectionNumber: '05', sectionLabel: 'Contact' }
        : undefined,
    ),
  );

  return {
    listingId: data.listing.id,
    templateId,
    pageSize: 'A4',
    orientation,
    pages,
    updatedAt: new Date().toISOString(),
  };
}

export const BROCHURE_LAYOUT_OPTIONS: Array<{
  id: BrochureLayoutId;
  label: string;
  description: string;
}> = [
  {
    id: 'cover_hero_band',
    label: 'Cover',
    description: 'Hero image with brand band',
  },
  {
    id: 'facts_table',
    label: 'Facts',
    description: 'Summary facts table',
  },
  {
    id: 'description_highlights',
    label: 'Description',
    description: 'Copy and key points',
  },
  {
    id: 'photo_full',
    label: 'Full-bleed photo',
    description: 'Single large photograph',
  },
  {
    id: 'photo_grid_2',
    label: 'Two photos',
    description: 'Side-by-side or stacked pair',
  },
  {
    id: 'photo_grid_3',
    label: 'Photo collage',
    description: '1+2 collage of three photos',
  },
  {
    id: 'floorplan',
    label: 'Floor plan',
    description: 'Dedicated floor plan page',
  },
  {
    id: 'map_amenities',
    label: 'Map & amenities',
    description: 'Map with amenity list',
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Agents and disclaimer',
  },
];

export function createBlankBrochurePage(
  layoutId: BrochureLayoutId,
): BrochurePage {
  const emptyImage = imageSlot(null, null);
  switch (layoutId) {
    case 'cover_hero_band':
      return page(layoutId, {
        hero: emptyImage,
        title: textSlot(''),
        address: textSlot(''),
        disposal: textSlot(''),
        headline: textSlot(''),
        brandName: textSlot(''),
      });
    case 'facts_table':
      return page(layoutId, {
        title: textSlot('Summary'),
        facts: { type: 'facts', rows: [] },
      });
    case 'description_highlights':
      return page(layoutId, {
        title: textSlot('About the property'),
        body: textSlot(''),
        highlights: textSlot(''),
      });
    case 'photo_full':
      return page(layoutId, { photo: emptyImage });
    case 'photo_grid_2':
      return page(layoutId, {
        photo1: emptyImage,
        photo2: emptyImage,
      });
    case 'photo_grid_3':
      return page(layoutId, {
        photo1: emptyImage,
        photo2: emptyImage,
        photo3: emptyImage,
      });
    case 'floorplan':
      return page(layoutId, {
        plan: emptyImage,
        caption: textSlot('Floor plan'),
      });
    case 'map_amenities':
      return page(layoutId, {
        title: textSlot('Location'),
        body: textSlot(''),
        map: {
          type: 'map',
          latitude: null,
          longitude: null,
          amenities: [],
        },
      });
    case 'contact':
      return page(layoutId, {
        title: textSlot('Contact'),
        notice: textSlot(''),
        agents: { type: 'agents' },
      });
    default:
      return page(layoutId, {});
  }
}
