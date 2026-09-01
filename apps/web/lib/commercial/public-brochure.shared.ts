import {
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';

export type BrochureMediaItem = {
  id: string;
  mediaType: 'image' | 'floorplan';
  url: string;
  fileName: string | null;
  isCover: boolean;
};

export type BrochureAgent = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  pictureUrl: string | null;
};

export type BrochureBranch = {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export type BrochureAmenity = {
  label: string;
  index: number;
};

export type BrochureListing = {
  id: string;
  accountId: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  disposalType: DisposalType;
  tenure: string | null;
  useClass: string | null;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  serviceChargePerSqft: number | null;
  ratesPayablePerSqft: number | null;
  estateChargePerSqft: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  epcBand: string | null;
  epcRating: number | null;
  availableFrom: string | null;
  summary: string | null;
  description: string | null;
  locationCopy: string | null;
  keyPoints: string[];
};

export type PublicBrochureData = {
  token: string;
  listing: BrochureListing;
  accountName: string | null;
  brand: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  agents: BrochureAgent[];
  images: BrochureMediaItem[];
  floorplans: BrochureMediaItem[];
  /** Workspace office used on the contact page (listing branch, else default). */
  branch?: BrochureBranch | null;
  /** Real nearby places from Mapbox; omit or empty to fall back to town centre. */
  nearbyAmenities?: BrochureAmenity[];
  /** Render-time reduced sash; also baked into the cover `reducedBadge` slot. */
  showReducedPrice?: boolean;
};

export function formatBrochureAddress(listing: BrochureListing): string {
  return [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.county,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function formatBrochureMoney(pence: number | null): string | null {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export function formatBrochureRent(listing: BrochureListing): string | null {
  if (listing.hideRentFromMarketing) return 'POA';
  if (!disposalIncludesToLet(listing.disposalType)) return null;

  const from = formatBrochureMoney(listing.askingRentPence);
  const to = formatBrochureMoney(listing.askingRentToPence);
  if (!from && !to) return 'POA';

  const range =
    from && to && from !== to ? `${from} – ${to}` : (from ?? to ?? 'POA');
  const freq = listing.rentFrequency?.trim();
  if (!freq || freq === 'pa' || freq === 'per_annum') {
    return `${range} pa`;
  }
  if (freq === 'pcm' || freq === 'per_month') {
    return `${range} pcm`;
  }
  return `${range} ${freq}`;
}

export function formatBrochurePrice(listing: BrochureListing): string | null {
  if (!disposalIncludesForSale(listing.disposalType)) return null;
  if (listing.hidePriceFromMarketing) return 'POA';
  return formatBrochureMoney(listing.askingPricePence) ?? 'POA';
}

export function formatBrochureSize(listing: BrochureListing): string | null {
  const min = listing.sizeMinSqft;
  const max = listing.sizeMaxSqft;
  if (min == null && max == null) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);

  if (min != null && max != null && min !== max) {
    return `${fmt(min)} – ${fmt(max)} sq ft`;
  }
  return `${fmt(min ?? max!)} sq ft`;
}

export function formatDisposalLabel(type: DisposalType): string {
  return DISPOSAL_TYPE_LABELS[type] ?? type;
}

/** Last path segment of a public brochure URL (`/share/brochure/:token`). */
export function extractBrochureShareToken(
  url: string | undefined | null,
): string | null {
  if (!url?.trim()) return null;

  try {
    const parsed = new URL(url, 'https://app.ozer.so');
    const token = parsed.pathname.split('/').filter(Boolean).at(-1);
    return token && token.length >= 16 ? token : null;
  } catch {
    return null;
  }
}
