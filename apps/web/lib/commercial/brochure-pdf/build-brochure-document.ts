import {
  type BrochureDisplayOptions,
  type BrochureDocument,
  type BrochureLayoutId,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureSlotValue,
  type BrochureTemplateId,
  DEFAULT_BROCHURE_DISPLAY_OPTIONS,
  newBrochurePageId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { buildCoverPriceLines } from '~/lib/commercial/brochure-pdf/cover-prices';
import {
  buildFallbackNearbyAmenities,
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
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
  display?: Partial<BrochureDisplayOptions>;
};

function resolveDisplay(
  display?: Partial<BrochureDisplayOptions>,
): BrochureDisplayOptions {
  return { ...DEFAULT_BROCHURE_DISPLAY_OPTIONS, ...display };
}

function formatPerSqft(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(value)} per sq ft`;
}

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
  display: BrochureDisplayOptions,
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

  if (display.showSize) {
    const size = formatBrochureSize(listing);
    if (size) rows.push({ label: 'Size', value: size });
  }

  if (display.showRent) {
    const rent = formatBrochureRent({
      ...listing,
      hideRentFromMarketing: false,
    });
    if (rent) rows.push({ label: 'Rent', value: rent });
  }

  if (display.showPrice) {
    const price = formatBrochurePrice({
      ...listing,
      hidePriceFromMarketing: false,
    });
    if (price) rows.push({ label: 'Price', value: price });
  }

  if (display.showRates) {
    const rates = formatPerSqft(listing.ratesPayablePerSqft);
    if (rates) rows.push({ label: 'Business rates', value: rates });
  }

  if (display.showServiceCharge) {
    const service = formatPerSqft(listing.serviceChargePerSqft);
    if (service) rows.push({ label: 'Service charge', value: service });
  }

  if (display.showEstateCharge) {
    const estate = formatPerSqft(listing.estateChargePerSqft);
    if (estate) rows.push({ label: 'Estate charge', value: estate });
  }

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

export function buildAmenities(data: PublicBrochureData): Array<{
  label: string;
  index: number;
}> {
  if (data.nearbyAmenities && data.nearbyAmenities.length > 0) {
    return sanitizeBrochureAmenities(data.nearbyAmenities, data.listing.town);
  }

  const amenities: Array<{ label: string; index: number }> = [
    ...buildFallbackNearbyAmenities(data.listing.town),
  ];

  // Short location bullets from listing copy — never a dummy outward-postcode line
  const locationBits = (data.listing.locationCopy ?? '')
    .split(/[\n•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 80)
    .slice(0, 4);

  for (const bit of locationBits) {
    if (amenities.length >= 6) break;
    amenities.push({ label: bit, index: amenities.length + 1 });
  }

  return sanitizeBrochureAmenities(amenities, data.listing.town);
}

export function coverSlots(
  data: PublicBrochureData,
  display: BrochureDisplayOptions,
): Record<string, BrochureSlotValue> {
  const cover = data.images.find((i) => i.isCover) ?? data.images[0] ?? null;
  const address = formatBrochureAddress(data.listing);
  const size = display.showSize ? formatBrochureSize(data.listing) : null;
  const rent = display.showRent
    ? formatBrochureRent({
        ...data.listing,
        hideRentFromMarketing: false,
      })
    : null;
  const price = display.showPrice
    ? formatBrochurePrice({
        ...data.listing,
        hidePriceFromMarketing: false,
      })
    : null;
  const priceLines = buildCoverPriceLines(data.listing, display);
  const showReduced =
    display.showReducedPrice || Boolean(data.showReducedPrice);

  return {
    hero: imageSlot(cover?.id ?? null, cover?.url ?? null),
    title: textSlot(data.listing.name),
    address: textSlot(address || data.listing.name),
    disposal: textSlot(formatDisposalLabel(data.listing.disposalType)),
    headline: textSlot(priceLines.join('\n')),
    size: textSlot(size ?? ''),
    rent: textSlot(rent ?? ''),
    price: textSlot(price ?? ''),
    reducedBadge: textSlot(showReduced ? 'REDUCED PRICE' : ''),
    brandName: textSlot(data.accountName ?? 'Agency'),
  };
}

function isShortBrochureCopy(
  descSlots: Record<string, BrochureSlotValue> | null,
): boolean {
  if (!descSlots) return true;
  const body =
    descSlots.body?.type === 'text' ? descSlots.body.text.trim() : '';
  const highlights =
    descSlots.highlights?.type === 'text'
      ? descSlots.highlights.text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
  return body.length <= 500 && highlights.length <= 5;
}

function contactSlots(
  data: PublicBrochureData,
  notice: string,
): Record<string, BrochureSlotValue> {
  return {
    title: textSlot('Contact'),
    notice: textSlot(notice),
    agents: { type: 'agents' },
    branchName: textSlot(data.branch?.name ?? data.accountName ?? ''),
    branchAddress: textSlot(data.branch?.address ?? ''),
    branchPhone: textSlot(data.branch?.phone ?? ''),
    branchEmail: textSlot(data.branch?.email ?? ''),
  };
}

function photoPages(
  data: PublicBrochureData,
  templateId: BrochureTemplateId,
  orientation: BrochureOrientation,
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

  // Editorial stays photo-led (one hero frame per page). Classic/compact pack
  // interiors so landscape packs are not a run of near-blank full-bleed pages.
  const preferFullBleed = templateId === 'editorial';

  while (i < pool.length) {
    const remaining = pool.length - i;

    if (preferFullBleed || remaining === 1 || templateId === 'compact') {
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

    if (
      remaining >= 3 &&
      templateId === 'classic' &&
      orientation === 'portrait'
    ) {
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

function descriptionSlots(
  data: PublicBrochureData,
  templateId: BrochureTemplateId,
): Record<string, BrochureSlotValue> | null {
  const description =
    data.listing.description?.trim() || data.listing.summary?.trim() || '';
  const highlights = data.listing.keyPoints.slice(0, 8);
  if (!description && highlights.length === 0) return null;

  const bodyLimit =
    templateId === 'editorial' ? 700 : templateId === 'compact' ? 900 : 1200;

  return {
    title: textSlot(
      templateId === 'editorial'
        ? 'Description'
        : templateId === 'compact'
          ? 'Highlights'
          : 'About the property',
    ),
    body: textSlot(description.slice(0, bodyLimit)),
    // Only populate when there are real key points — renderer omits empty section
    highlights: textSlot(
      highlights.length > 0 ? highlights.map((h) => `• ${h}`).join('\n') : '',
    ),
  };
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
  const display = resolveDisplay(options.display);
  const facts = buildFactsRows(data, display);
  const amenities = buildAmenities(data);
  const descSlots = descriptionSlots(data, templateId);
  const locationCopy = data.listing.locationCopy?.trim() ?? '';

  const pages: BrochurePage[] = [];

  // Cover — always
  pages.push(
    page(
      'cover_hero_band',
      coverSlots(data, display),
      templateId === 'editorial'
        ? { sectionNumber: '01', sectionLabel: 'Cover' }
        : undefined,
    ),
  );

  if (templateId === 'compact') {
    // Short pack: cover, facts (+ copy when brief), one photo, map, contact
    const combineCopy = isShortBrochureCopy(descSlots);
    if (facts.length > 0) {
      pages.push(
        page('facts_table', {
          facts: { type: 'facts', rows: facts },
          title: textSlot('The offering'),
          ...(combineCopy && descSlots
            ? { body: descSlots.body, highlights: descSlots.highlights }
            : {}),
        }),
      );
    }

    if (descSlots && (!combineCopy || facts.length === 0)) {
      pages.push(page('description_highlights', descSlots));
    }

    pages.push(...photoPages(data, templateId, orientation).slice(0, 1));

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
      page(
        'contact',
        contactSlots(
          data,
          'Important notice: These particulars are for guidance only and do not constitute any part of an offer or contract. All descriptions, dimensions and other details are given in good faith but should not be relied upon as statements of fact.',
        ),
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

  // Classic + Editorial fuller packs
  const combineCopy =
    templateId === 'classic' && isShortBrochureCopy(descSlots);
  if (facts.length > 0) {
    pages.push(
      page(
        'facts_table',
        {
          facts: { type: 'facts', rows: facts },
          title: textSlot(
            templateId === 'editorial' ? 'The offering' : 'Summary',
          ),
          ...(combineCopy && descSlots
            ? { body: descSlots.body, highlights: descSlots.highlights }
            : {}),
        },
        templateId === 'editorial'
          ? { sectionNumber: '02', sectionLabel: 'The offering' }
          : undefined,
      ),
    );
  }

  if (descSlots && (!combineCopy || facts.length === 0)) {
    pages.push(
      page(
        'description_highlights',
        descSlots,
        templateId === 'editorial'
          ? { sectionNumber: '03', sectionLabel: 'Description' }
          : undefined,
      ),
    );
  }

  const galleryLimit =
    templateId === 'editorial' ? 6 : orientation === 'landscape' ? 5 : 4;
  pages.push(
    ...photoPages(data, templateId, orientation).slice(0, galleryLimit),
  );

  if (templateId === 'classic') {
    pages.push(...floorplanPages(data));
  } else {
    // Editorial: at most one floorplan page to keep the pack photo-led
    pages.push(...floorplanPages(data).slice(0, 1));
  }

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
      contactSlots(
        data,
        'Important notice: These particulars are believed to be correct but their accuracy is not guaranteed and they do not form part of any contract. Interested parties should satisfy themselves by inspection or otherwise as to the correctness of each statement.',
      ),
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
        size: textSlot(''),
        rent: textSlot(''),
        price: textSlot(''),
        reducedBadge: textSlot(''),
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
        branchName: textSlot(''),
        branchAddress: textSlot(''),
        branchPhone: textSlot(''),
        branchEmail: textSlot(''),
      });
    default:
      return page(layoutId, {});
  }
}
