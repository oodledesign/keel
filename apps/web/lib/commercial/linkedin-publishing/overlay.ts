import {
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  type BrochureListing,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
} from '~/lib/commercial/public-brochure.shared';
import { ozerColors } from '~/lib/ozer/design-tokens';

export const LINKEDIN_IMAGE_ASPECT = 1.91;
export const LINKEDIN_OVERLAY_WIDTH = 1200;
export const LINKEDIN_OVERLAY_HEIGHT = 628;

const LISTING_STATUSES = Object.keys(LISTING_STATUS_LABELS) as ListingStatus[];

export type OverlayListing = {
  status: string;
  disposalType: DisposalType | string;
  town: string | null;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
};

function asBrochureListing(listing: OverlayListing): BrochureListing {
  const disposalType = (DISPOSAL_TYPES as readonly string[]).includes(
    listing.disposalType,
  )
    ? (listing.disposalType as DisposalType)
    : 'to_let';

  return {
    id: '',
    accountId: '',
    name: '',
    addressLine1: null,
    addressLine2: null,
    town: listing.town,
    county: null,
    postcode: null,
    latitude: null,
    longitude: null,
    disposalType,
    tenure: null,
    useClass: null,
    askingRentPence: listing.askingRentPence,
    askingRentToPence: listing.askingRentToPence,
    askingPricePence: listing.askingPricePence,
    rentFrequency: listing.rentFrequency,
    hideRentFromMarketing: listing.hideRentFromMarketing,
    hidePriceFromMarketing: listing.hidePriceFromMarketing,
    serviceChargePerSqft: null,
    ratesPayablePerSqft: null,
    estateChargePerSqft: null,
    sizeMinSqft: listing.sizeMinSqft,
    sizeMaxSqft: listing.sizeMaxSqft,
    epcBand: null,
    epcRating: null,
    availableFrom: null,
    summary: null,
    description: null,
    locationCopy: null,
    keyPoints: [],
  };
}

export type OverlaySpec = {
  statusChip: string;
  priceLine: string | null;
  standoutLine: string | null;
  overlayFirst: boolean;
};

export function isKnownListingStatus(value: string): value is ListingStatus {
  return LISTING_STATUSES.includes(value as ListingStatus);
}

/**
 * Marketing sash: under offer / let / sold / withdrawn use status;
 * otherwise To Let / For Sale from disposal type.
 */
export function overlayStatusLabel(
  status: string,
  disposalType: string | null | undefined,
): string {
  if (isKnownListingStatus(status)) {
    if (
      status === 'under_offer' ||
      status === 'let' ||
      status === 'sold' ||
      status === 'withdrawn'
    ) {
      return LISTING_STATUS_LABELS[status];
    }
  }

  if (disposalType && disposalType in DISPOSAL_TYPE_LABELS) {
    return DISPOSAL_TYPE_LABELS[disposalType as DisposalType];
  }

  if (isKnownListingStatus(status)) {
    return LISTING_STATUS_LABELS[status];
  }

  return 'To let';
}

export function overlayStatusChip(
  status: string,
  disposalType: string | null | undefined,
): string {
  return overlayStatusLabel(status, disposalType).toUpperCase();
}

export function overlayPriceLine(listing: OverlayListing): string | null {
  const brochure = asBrochureListing(listing);
  const rent = formatBrochureRent(brochure);
  const price = formatBrochurePrice(brochure);
  if (rent && price) return `${rent}  ·  ${price}`;
  return rent ?? price;
}

export function overlayStandoutLine(listing: OverlayListing): string | null {
  const town = listing.town?.trim();
  if (town) return town;
  return formatBrochureSize(asBrochureListing(listing));
}

export function buildOverlaySpec(
  listing: OverlayListing,
  overlayFirst = true,
): OverlaySpec {
  return {
    statusChip: overlayStatusChip(listing.status, listing.disposalType),
    priceLine: overlayPriceLine(listing),
    standoutLine: overlayStandoutLine(listing),
    overlayFirst,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** SVG overlay bar — cream/plum/coral, readable on a 1200×628 crop. */
export function buildOverlaySvg(spec: OverlaySpec): string {
  const cream = ozerColors.cream;
  const plum = ozerColors.plum;
  const coral = ozerColors.accent;
  const chip = escapeXml(spec.statusChip);
  const price = spec.priceLine ? escapeXml(spec.priceLine) : '';
  const standout = spec.standoutLine ? escapeXml(spec.standoutLine) : '';

  const chipWidth = Math.min(360, 28 + chip.length * 16);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${LINKEDIN_OVERLAY_WIDTH}" height="${LINKEDIN_OVERLAY_HEIGHT}" viewBox="0 0 ${LINKEDIN_OVERLAY_WIDTH} ${LINKEDIN_OVERLAY_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${plum}" stop-opacity="0"/>
      <stop offset="45%" stop-color="${plum}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${plum}" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect x="0" y="360" width="${LINKEDIN_OVERLAY_WIDTH}" height="268" fill="url(#fade)"/>
  <rect x="36" y="404" rx="8" ry="8" width="${chipWidth}" height="36" fill="${coral}"/>
  <text x="${36 + chipWidth / 2}" y="429" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="${cream}" letter-spacing="1.2">${chip}</text>
  ${
    price
      ? `<text x="36" y="488" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="${cream}">${price}</text>`
      : ''
  }
  ${
    standout
      ? `<text x="36" y="${price ? 532 : 488}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="${cream}">${standout}</text>`
      : ''
  }
</svg>`;
}
