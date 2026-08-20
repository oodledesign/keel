import 'server-only';

import type {
  DisposalType,
  ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';

import { RIGHTMOVE_MEDIA_URL_MAX_LENGTH } from './listing-media-public-url';
import type {
  RightmoveAreaSizeUnit,
  RightmoveBuildingPriceDisplayQualifier,
  RightmoveBuildingSizing,
  RightmoveMedia,
  RightmoveMediaAsset,
  RightmovePropertyClassification,
  RightmovePropertyPayload,
  RightmoveRentFrequency,
  RightmoveSpace,
  RightmoveStatus,
  RightmoveSubType,
  RightmoveTransactionType,
} from './rightmove-types';

export type RightmoveMapperListing = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  sector: string | null;
  tenure: string | null;
  disposalType: DisposalType;
  status: ListingStatus;
  askingRentPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  measurementStandard: string | null;
  useClass: string | null;
  availableFrom: string | null;
  epcRating: number | null;
  breeamRating: string | null;
  summary: string | null;
  description: string | null;
  keyPoints: string[];
  referenceNumber: string | null;
};

export type RightmoveMapperUnit = {
  id: string;
  label: string;
  floorOrUnit: string | null;
  sizeSqft: number | null;
  measurementStandard: string | null;
  sortOrder: number;
  externalId: string | null;
};

export type RightmoveMapperMedia = {
  mediaType: string;
  mimeType: string | null;
  fileName: string | null;
  url: string | null;
  sortOrder: number;
  isCover: boolean;
};

const REFERENCE_PATTERN = /^[a-zA-Z0-9-_]{1,100}$/;

const SECTOR_RULES: Array<{ test: RegExp; subType: RightmoveSubType }> = [
  { test: /serviced\s*office|co-?work/i, subType: 'SERVICED_OFFICE' },
  { test: /business\s*park/i, subType: 'BUSINESS_PARK' },
  { test: /office/i, subType: 'OFFICE' },
  { test: /showroom/i, subType: 'SHOWROOM' },
  { test: /convenience/i, subType: 'CONVENIENCE_STORE' },
  { test: /post\s*office/i, subType: 'POST_OFFICE' },
  { test: /trade\s*counter/i, subType: 'TRADE_COUNTER' },
  {
    test: /shopping\s*centre|shopping\s*center/i,
    subType: 'RETAIL_PROPERTY_SHOPPING_CENTRE',
  },
  { test: /out\s*of\s*town/i, subType: 'RETAIL_OUT_OF_TOWN' },
  { test: /retail|shop|high\s*street/i, subType: 'RETAIL_HIGH_STREET' },
  { test: /self[\s-]?storage/i, subType: 'SELF_STORAGE' },
  { test: /warehouse/i, subType: 'WAREHOUSE' },
  { test: /workshop/i, subType: 'WORKSHOP' },
  { test: /heavy\s*industrial/i, subType: 'HEAVY_INDUSTRIAL' },
  { test: /industrial\s*park/i, subType: 'INDUSTRIAL_PARK' },
  // Match industrial before logistics so "Industrial/Logistics" → LIGHT_INDUSTRIAL.
  { test: /industrial|factory|manufactur/i, subType: 'LIGHT_INDUSTRIAL' },
  { test: /distribution|logistics/i, subType: 'DISTRIBUTION_WAREHOUSE' },
  { test: /hotel|guest\s*house/i, subType: 'HOTEL' },
  { test: /takeaway/i, subType: 'TAKEAWAY' },
  { test: /\bpub\b/i, subType: 'PUB' },
  { test: /\bbar\b/i, subType: 'BAR' },
  { test: /restaurant/i, subType: 'RESTAURANT' },
  { test: /\bcafe\b|\bcafé\b/i, subType: 'CAFE' },
  { test: /leisure|gym|fitness/i, subType: 'LEISURE_FACILITY' },
  { test: /woodland/i, subType: 'WOODLAND' },
  { test: /\bfarm\b/i, subType: 'FARM' },
  { test: /residential\s*development/i, subType: 'RESIDENTIAL_DEVELOPMENT' },
  { test: /development/i, subType: 'COMMERCIAL_DEVELOPMENT' },
  { test: /\bland\b/i, subType: 'LAND' },
  { test: /mixed/i, subType: 'MIXED_USE' },
  { test: /data\s*cent/i, subType: 'DATA_CENTRE' },
  { test: /student/i, subType: 'STUDENT_HOUSING' },
];

/** Rightmove ADF `building.useClasses` enum (rejects anything else). */
const RIGHTMOVE_USE_CLASSES = new Set([
  'CLASS_1A',
  'CLASS_3',
  'CLASS_4',
  'CLASS_5',
  'CLASS_6',
  'CLASS_7',
  'CLASS_8',
  'CLASS_9',
  'CLASS_10',
  'CLASS_11',
  'CLASS_B2',
  'CLASS_B8',
  'CLASS_C1',
  'CLASS_C2',
  'CLASS_C2A',
  'CLASS_C3',
  'CLASS_C4',
  'CLASS_E',
  'CLASS_F1',
  'CLASS_F2',
  'SUI_GENERIS',
]);

const USE_CLASS_TOKEN_ALIASES: Record<string, string> = {
  e: 'CLASS_E',
  f: 'CLASS_F1',
  f1: 'CLASS_F1',
  f2: 'CLASS_F2',
  b1: 'CLASS_E',
  b2: 'CLASS_B2',
  b8: 'CLASS_B8',
  c1: 'CLASS_C1',
  c2: 'CLASS_C2',
  c2a: 'CLASS_C2A',
  c3: 'CLASS_C3',
  c4: 'CLASS_C4',
  a1: 'CLASS_1A',
  a2: 'CLASS_E',
  a3: 'CLASS_E',
  a4: 'SUI_GENERIS',
  a5: 'SUI_GENERIS',
  '1a': 'CLASS_1A',
  '3': 'CLASS_3',
  '4': 'CLASS_4',
  '5': 'CLASS_5',
  '6': 'CLASS_6',
  '7': 'CLASS_7',
  '8': 'CLASS_8',
  '9': 'CLASS_9',
  '10': 'CLASS_10',
  '11': 'CLASS_11',
};

function tokenToRightmoveUseClass(token: string): string | null {
  const key = token
    .trim()
    .toLowerCase()
    .replace(/^class[\s_-]*/, '')
    .replace(/[\s_-]+/g, '');
  if (!key) return null;
  const aliased = USE_CLASS_TOKEN_ALIASES[key];
  if (aliased && RIGHTMOVE_USE_CLASSES.has(aliased)) return aliased;
  const asClass = `CLASS_${key.toUpperCase()}`;
  if (RIGHTMOVE_USE_CLASSES.has(asClass)) return asClass;
  if (RIGHTMOVE_USE_CLASSES.has(key.toUpperCase())) return key.toUpperCase();
  return null;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + '…';
}

/** Coerce Postgres `numeric` (often a string via PostgREST) to a finite number. */
export function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rightmove rejects lat/long with more than 6 decimal places
 * (`building.location.longitude` / `latitude` validation).
 */
export function roundCoordinate(
  value: number | null | undefined,
): number | null {
  const n = asOptionalNumber(value);
  if (n == null) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
}

function penceToPounds(pence: number | null | undefined): number | null {
  if (pence == null) return null;
  return Math.round(pence) / 100;
}

export function sanitizeRightmoveReference(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return cleaned || 'listing';
}

export function resolveRightmovePropertyReference(
  listing: Pick<RightmoveMapperListing, 'id' | 'referenceNumber'>,
): string {
  const preferred = listing.referenceNumber?.trim();
  if (preferred && REFERENCE_PATTERN.test(preferred)) {
    return preferred;
  }
  if (preferred) {
    return sanitizeRightmoveReference(preferred);
  }
  return sanitizeRightmoveReference(listing.id);
}

export function mapSectorToSubType(sector: string | null): RightmoveSubType {
  const value = sector?.trim();
  if (!value) return 'OFFICE';
  const exact = value.toUpperCase().replace(/\s+/g, '_');
  const known = SECTOR_RULES.map((r) => r.subType);
  if ((known as string[]).includes(exact)) {
    return exact as RightmoveSubType;
  }
  for (const rule of SECTOR_RULES) {
    if (rule.test.test(value)) return rule.subType;
  }
  return 'OTHER';
}

function mapTransactionType(
  disposalType: DisposalType,
): RightmoveTransactionType {
  // Rightmove accepts a single transaction type; dual disposals publish as lettings.
  return disposalIncludesToLet(disposalType) ? 'LETTINGS' : 'SALES';
}

export function mapListingStatusToRightmove(
  status: ListingStatus,
): RightmoveStatus {
  switch (status) {
    case 'under_offer':
      return 'UNDER_OFFER';
    case 'let':
      return 'LET_AGREED';
    case 'sold':
      return 'SOLD_STC';
    default:
      return 'AVAILABLE';
  }
}

export function isRightmoveMarketableStatus(status: ListingStatus): boolean {
  return status === 'marketing' || status === 'under_offer';
}

function mapRentFrequency(
  frequency: string | null,
): RightmoveRentFrequency | undefined {
  if (!frequency) return undefined;
  const normalized = frequency.trim().toLowerCase();
  if (
    normalized.includes('year') ||
    normalized.includes('annual') ||
    normalized === 'pa' ||
    normalized === 'p.a.'
  ) {
    return 'YEARLY';
  }
  if (normalized.includes('month') || normalized === 'pcm') {
    return 'MONTHLY';
  }
  return 'YEARLY';
}

function mapTenure(
  tenure: string | null,
): 'FREEHOLD' | 'LEASEHOLD' | 'SHARE_OF_FREEHOLD' | undefined {
  if (!tenure) return undefined;
  const value = tenure.trim().toLowerCase();
  if (value.includes('share')) return 'SHARE_OF_FREEHOLD';
  if (value.includes('free')) return 'FREEHOLD';
  if (value.includes('lease')) return 'LEASEHOLD';
  return undefined;
}

/**
 * Map free-text listing use class (e.g. "Class E - Commercial, Business and
 * Service") onto Rightmove's closed enum. Passing through `CLASS_*` prefixes
 * without a whitelist produced invalid values such as `CLASS_E_-_COMMERCIAL`.
 */
export function mapUseClasses(useClass: string | null): string[] | undefined {
  if (!useClass?.trim()) return undefined;
  const text = useClass.trim();
  const mapped: string[] = [];

  if (/sui[\s_-]*generis/i.test(text)) {
    mapped.push('SUI_GENERIS');
  }

  const classToken =
    /class[\s_-]*(c2a|f1|f2|b1|b2|b8|c1|c2|c3|c4|a1|a2|a3|a4|a5|1a|10|11|[3-9]|e|f)(?![a-z0-9])/gi;
  for (const match of text.matchAll(classToken)) {
    const converted = tokenToRightmoveUseClass(match[1] ?? '');
    if (converted) mapped.push(converted);
  }

  if (mapped.length === 0) {
    const parts = text
      .split(/[,/;+|]+/)
      .map((part) =>
        part
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\s*[-–—].*$/, '')
          .trim(),
      )
      .filter(Boolean);
    for (const part of parts) {
      const converted = tokenToRightmoveUseClass(part);
      if (converted) mapped.push(converted);
    }
  }

  const unique = [...new Set(mapped)].filter((value) =>
    RIGHTMOVE_USE_CLASSES.has(value),
  );
  return unique.length ? unique : undefined;
}

function mapMeasurementType(standard: string | null): string | undefined {
  if (!standard?.trim()) return undefined;
  const value = standard
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const allowed = new Set([
    'GEA',
    'GIA',
    'NIA',
    'IPMS1',
    'IPMS2',
    'IPMS3_1',
    'IPMS3_2',
  ]);
  if (allowed.has(value)) return value;
  if (value.includes('NIA') || value.includes('NET')) return 'NIA';
  if (value.includes('GIA') || value.includes('GROSS_INTERNAL')) return 'GIA';
  if (value.includes('GEA') || value.includes('EXTERNAL')) return 'GEA';
  if (value.includes('IPMS3')) return 'IPMS3_1';
  if (value.includes('IPMS2')) return 'IPMS2';
  if (value.includes('IPMS1') || value.includes('IPMS')) return 'IPMS1';
  return undefined;
}

function mapBreeamToScore(breeam: string | null): number | undefined {
  if (!breeam) return undefined;
  switch (breeam.toLowerCase()) {
    case 'outstanding':
      return 95;
    case 'excellent':
      return 85;
    case 'very_good':
      return 70;
    case 'good':
      return 55;
    case 'pass':
      return 40;
    default:
      return undefined;
  }
}

function buildDisplayAddress(listing: RightmoveMapperListing): string {
  const parts = [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
  ].filter((p): p is string => Boolean(p?.trim()));
  const joined = parts.join(', ').trim() || listing.name;
  return clip(joined, 120);
}

function buildClassification(
  sector: string | null,
): RightmovePropertyClassification {
  return { subType: mapSectorToSubType(sector) };
}

function buildBuildingPricing(listing: RightmoveMapperListing): {
  price: number;
  displayQualifier?: RightmoveBuildingPriceDisplayQualifier;
  frequency?: RightmoveRentFrequency;
} {
  const isLettings = disposalIncludesToLet(listing.disposalType);
  const isSales = disposalIncludesForSale(listing.disposalType);
  const hideRent = listing.hideRentFromMarketing && isLettings;
  const hidePrice = listing.hidePriceFromMarketing && isSales;
  const rent = penceToPounds(listing.askingRentPence);
  const price = penceToPounds(listing.askingPricePence);

  // Prefer lettings channel pricing when dual / to-let.
  if (isLettings && (!isSales || rent != null || hideRent)) {
    if (hideRent) {
      return {
        price: rent ?? price ?? 0,
        displayQualifier: 'PRICE_ON_APPLICATION',
        frequency: mapRentFrequency(listing.rentFrequency) ?? 'YEARLY',
      };
    }
    return {
      price: rent ?? 0,
      frequency: mapRentFrequency(listing.rentFrequency) ?? 'YEARLY',
    };
  }

  if (hidePrice) {
    return {
      price: price ?? rent ?? 0,
      displayQualifier: 'PRICE_ON_APPLICATION',
    };
  }

  return {
    price: price ?? 0,
  };
}

function buildBuildingSizing(
  listing: RightmoveMapperListing,
): RightmoveBuildingSizing | undefined {
  const min = asOptionalNumber(listing.sizeMinSqft);
  const max = asOptionalNumber(listing.sizeMaxSqft);
  const unit: RightmoveAreaSizeUnit = 'SQFT';
  const measurementType = mapMeasurementType(listing.measurementStandard);

  if (min != null && max != null && min !== max) {
    return {
      minSize: Math.min(min, max),
      maxSize: Math.max(min, max),
      unit,
      ...(measurementType ? { measurementType } : {}),
    };
  }

  const size = max ?? min;
  if (size == null) return undefined;
  return {
    size,
    unit,
    ...(measurementType ? { measurementType } : {}),
  };
}

function keyFeatures(points: string[], minItems = 0): string[] | undefined {
  const features = points
    .map((p) => clip(p, 200))
    .filter(Boolean)
    .slice(0, 10);
  if (features.length < minItems) return undefined;
  return features.length ? features : undefined;
}

function mediaAsset(
  url: string,
  order: number,
  description?: string | null,
): RightmoveMediaAsset | null {
  // Rightmove OpenAPI: url maxLength 250. Never truncate — that produces
  // invalid URLs (and we used to append an ellipsis).
  if (url.length > RIGHTMOVE_MEDIA_URL_MAX_LENGTH) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return null;
  }

  return {
    url,
    order,
    ...(description?.trim()
      ? { description: clip(description.trim(), 200) }
      : {}),
  };
}

function pathEndsWithPdf(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return /\.pdf(?:$|[?#])/i.test(url);
  }
}

export function mapListingMediaToRightmove(
  media: RightmoveMapperMedia[],
): RightmoveMedia | undefined {
  const photos: RightmoveMediaAsset[] = [];
  const floorPlans: RightmoveMediaAsset[] = [];
  const epcs: RightmoveMediaAsset[] = [];
  const brochures: RightmoveMediaAsset[] = [];
  const virtualTours: RightmoveMediaAsset[] = [];

  const sorted = [...media].sort((a, b) => {
    if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  for (const item of sorted) {
    const url = item.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const label = item.fileName ?? undefined;
    const order = item.sortOrder;

    if (item.mediaType === 'floorplan') {
      const asset = mediaAsset(url, order, label);
      if (asset) floorPlans.push(asset);
      continue;
    }
    if (item.mediaType === 'epc') {
      const asset = mediaAsset(url, order, label);
      if (asset) epcs.push(asset);
      continue;
    }
    if (item.mediaType === 'brochure') {
      // Rightmove: brochure URLs must have a .pdf extension.
      if (!pathEndsWithPdf(url)) continue;
      const asset = mediaAsset(url, order, label);
      if (asset) brochures.push(asset);
      continue;
    }
    if (item.mediaType === 'video') {
      const asset = mediaAsset(url, order, label);
      if (asset) virtualTours.push(asset);
      continue;
    }
    if (
      item.mediaType === 'image' ||
      item.mimeType?.startsWith('image/') ||
      item.mediaType === 'other'
    ) {
      const asset = mediaAsset(url, order, label);
      if (asset) photos.push(asset);
    }
  }

  const result: RightmoveMedia = {};
  if (photos.length) result.photos = photos;
  if (floorPlans.length) result.floorPlans = floorPlans;
  if (epcs.length) result.epcs = epcs;
  if (brochures.length) result.brochures = brochures;
  if (virtualTours.length) result.virtualTours = virtualTours;

  return Object.keys(result).length ? result : undefined;
}

function availableDate(value: string | null): string | undefined {
  if (!value) return undefined;
  // Expect YYYY-MM-DD (date columns / ISO prefixes)
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function spaceReference(
  buildingReference: string,
  unit: RightmoveMapperUnit,
  index: number,
): string {
  const preferred = unit.externalId?.trim();
  if (
    preferred &&
    REFERENCE_PATTERN.test(preferred) &&
    preferred !== buildingReference
  ) {
    return preferred;
  }
  const fromId = sanitizeRightmoveReference(`u-${unit.id}`);
  if (fromId !== buildingReference) return fromId;
  return sanitizeRightmoveReference(`${buildingReference}-space-${index + 1}`);
}

function mapUnitsToSpaces(input: {
  buildingReference: string;
  listing: RightmoveMapperListing;
  units: RightmoveMapperUnit[];
  status: RightmoveStatus;
  published: boolean;
  classification: RightmovePropertyClassification;
}): RightmoveSpace[] {
  const {
    buildingReference,
    listing,
    units,
    status,
    published,
    classification,
  } = input;

  return units.map((unit, index) => {
    const size =
      asOptionalNumber(unit.sizeSqft) ??
      asOptionalNumber(listing.sizeMinSqft) ??
      asOptionalNumber(listing.sizeMaxSqft) ??
      1;
    const features = keyFeatures(listing.keyPoints, 1);
    const measurementType = mapMeasurementType(
      unit.measurementStandard ?? listing.measurementStandard,
    );
    return {
      reference: spaceReference(buildingReference, unit, index),
      name: clip(unit.label || unit.floorOrUnit || `Space ${index + 1}`, 200),
      floorIdentifier: clip(
        unit.floorOrUnit || unit.label || `Unit ${index + 1}`,
        50,
      ),
      description: clip(
        listing.description || listing.summary || listing.name,
        1_000_000,
      ),
      sizing: {
        size,
        unit: 'SQFT',
        ...(measurementType ? { measurementType } : {}),
      },
      status,
      published,
      primaryPropertyClassification: classification,
      order: index + 1,
      ...(features ? { keyFeatures: features } : {}),
      ...(availableDate(listing.availableFrom)
        ? { availableDate: availableDate(listing.availableFrom) }
        : {}),
    };
  });
}

export type MapListingToRightmoveResult = {
  reference: string;
  payload: RightmovePropertyPayload;
  published: boolean;
};

/**
 * Map an Ozer commercial listing (+ optional units/media) to a Rightmove
 * Commercial Property PUT body (building-only or building-with-spaces).
 */
export function mapListingToRightmovePayload(input: {
  listing: RightmoveMapperListing;
  agentId: number;
  units?: RightmoveMapperUnit[];
  media?: RightmoveMapperMedia[];
  /** Override published flag (defaults from listing status). */
  published?: boolean;
}): MapListingToRightmoveResult {
  const { listing, agentId } = input;
  const reference = resolveRightmovePropertyReference(listing);
  const published =
    input.published ?? isRightmoveMarketableStatus(listing.status);
  const status = mapListingStatusToRightmove(listing.status);
  const classification = buildClassification(listing.sector);
  const pricing = buildBuildingPricing(listing);
  const sizing = buildBuildingSizing(listing);
  const media = input.media
    ? mapListingMediaToRightmove(input.media)
    : undefined;
  const features = keyFeatures(listing.keyPoints, 0);
  const useClasses = mapUseClasses(listing.useClass);
  const tenureType = mapTenure(listing.tenure);
  const epcRating =
    listing.epcRating != null && Number.isFinite(listing.epcRating)
      ? Math.round(listing.epcRating)
      : undefined;
  const breeamRating = mapBreeamToScore(listing.breeamRating);
  const latitude = roundCoordinate(listing.latitude);
  const longitude = roundCoordinate(listing.longitude);

  const buildingBase = {
    agentId,
    description: clip(
      listing.description || listing.summary || listing.name,
      1_000_000,
    ),
    summary: clip(listing.summary || listing.name, 1500),
    transactionType: mapTransactionType(listing.disposalType),
    pricing,
    primaryPropertyClassification: classification,
    status,
    published,
    location: {
      displayAddress: buildDisplayAddress(listing),
      buildingIdentifier: clip(listing.addressLine1 || listing.name, 100),
      postcode: clip(listing.postcode?.trim() || '', 9),
      ...(latitude != null ? { latitude } : {}),
      ...(longitude != null ? { longitude } : {}),
      showMap: latitude != null && longitude != null,
    },
    ...(sizing ? { sizing } : {}),
    ...(features ? { keyFeatures: features } : {}),
    ...(useClasses ? { useClasses } : {}),
    ...(tenureType ? { tenureType } : {}),
    ...(media ? { media } : {}),
    ...(availableDate(listing.availableFrom)
      ? { availableDate: availableDate(listing.availableFrom) }
      : {}),
    ...(epcRating != null || breeamRating != null
      ? {
          environment: {
            ...(epcRating != null ? { epcRating } : {}),
            ...(breeamRating != null ? { breeamRating } : {}),
          },
        }
      : {}),
  };

  const units = (input.units ?? []).filter(
    (u) => u.label?.trim() || u.floorOrUnit?.trim() || u.sizeSqft != null,
  );

  if (units.length > 0) {
    const spaces = mapUnitsToSpaces({
      buildingReference: reference,
      listing,
      units: units.slice(0, 50),
      status,
      published,
      classification,
    });
    return {
      reference,
      published,
      payload: {
        building: {
          ...buildingBase,
          spaces,
        },
      },
    };
  }

  return {
    reference,
    published,
    payload: {
      building: buildingBase,
    },
  };
}
