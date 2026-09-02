import {
  COMMERCIAL_USE_CLASS_LABELS,
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  formatCommercialUseClassLabel,
  isCommercialUseClass,
} from '~/lib/commercial/commercial-constants';
import {
  type BrochureListing,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
} from '~/lib/commercial/public-brochure.shared';

export const MAX_LINKEDIN_HASHTAGS = 3;

export type LinkedInCopyListing = Pick<
  BrochureListing,
  | 'name'
  | 'addressLine1'
  | 'addressLine2'
  | 'town'
  | 'county'
  | 'postcode'
  | 'disposalType'
  | 'tenure'
  | 'useClass'
  | 'askingRentPence'
  | 'askingRentToPence'
  | 'askingPricePence'
  | 'rentFrequency'
  | 'hideRentFromMarketing'
  | 'hidePriceFromMarketing'
  | 'sizeMinSqft'
  | 'sizeMaxSqft'
  | 'summary'
  | 'description'
  | 'keyPoints'
> & {
  sector?: string | null;
};

export function formatListingAddressLine(
  listing: LinkedInCopyListing,
): string | null {
  const parts = [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.county,
    listing.postcode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : listing.name?.trim() || null;
}

export function formatTenureLabel(
  tenure: string | null | undefined,
): string | null {
  if (!tenure?.trim()) return null;
  return tenure
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatUseClassShort(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (isCommercialUseClass(trimmed)) {
    const full = COMMERCIAL_USE_CLASS_LABELS[trimmed];
    const short = full.split('–')[0]?.trim() ?? full;
    return short;
  }
  return formatCommercialUseClassLabel(trimmed);
}

export function countHashtags(text: string): number {
  const matches = text.match(/(^|\s)#[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

/** Keep at most `max` hashtags; extra ones are stripped. */
export function clampHashtags(
  text: string,
  max = MAX_LINKEDIN_HASHTAGS,
): string {
  let seen = 0;
  return text
    .replace(
      /(^|\s)(#[\p{L}\p{N}_]+)/gu,
      (full, prefix: string, tag: string) => {
        seen += 1;
        return seen <= max ? `${prefix}${tag}` : prefix.replace(/\s+$/, '');
      },
    )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Put the public listing URL on its own last line. */
export function appendListingUrl(
  body: string,
  url: string | null | undefined,
): string {
  const trimmed = body.replace(/\s+$/g, '').trimStart();
  if (!url?.trim()) return trimmed.trim();
  const cleanUrl = url.trim();
  const withoutUrl = trimmed
    .split('\n')
    .map((line) => line.replaceAll(cleanUrl, '').replace(/[ \t]+$/g, ''))
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .replace(/\s+$/g, '');
  if (!withoutUrl) return cleanUrl;
  return `${withoutUrl}\n\n${cleanUrl}`;
}

export function buildDescriptionSourceCopy(input: {
  summary?: string | null;
  description?: string | null;
  listingUrl?: string | null;
}): string {
  const description = input.description?.trim() ?? '';
  const summary = input.summary?.trim() ?? '';
  const body = description || summary;
  return appendListingUrl(clampHashtags(body), input.listingUrl);
}

/**
 * Fact-only short post from listing fields (used for tests and as a non-AI fallback).
 */
function asBrochureListing(listing: LinkedInCopyListing): BrochureListing {
  const disposalType = (DISPOSAL_TYPES as readonly string[]).includes(
    listing.disposalType,
  )
    ? (listing.disposalType as DisposalType)
    : 'to_let';

  return {
    id: '',
    accountId: '',
    name: listing.name,
    addressLine1: listing.addressLine1,
    addressLine2: listing.addressLine2,
    town: listing.town,
    county: listing.county,
    postcode: listing.postcode,
    latitude: null,
    longitude: null,
    disposalType,
    tenure: listing.tenure,
    useClass: listing.useClass,
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
    summary: listing.summary,
    description: listing.description,
    locationCopy: null,
    keyPoints: listing.keyPoints,
  };
}

export function buildStructuredLinkedInCopy(
  listing: LinkedInCopyListing,
  listingUrl?: string | null,
): string {
  const lines: string[] = [];
  const disposal =
    DISPOSAL_TYPE_LABELS[listing.disposalType as DisposalType] ??
    listing.disposalType;
  const address = formatListingAddressLine(listing);
  const headline = [disposal, address].filter(Boolean).join(' — ');
  if (headline) lines.push(headline);

  const facts: string[] = [];
  const brochure = asBrochureListing(listing);
  const size = formatBrochureSize(brochure);
  if (size) facts.push(size);
  const tenure = formatTenureLabel(listing.tenure);
  if (tenure) facts.push(tenure);
  const rent = formatBrochureRent(brochure);
  if (rent) facts.push(rent);
  const price = formatBrochurePrice(brochure);
  if (price) facts.push(price);
  const sector = listing.sector?.trim();
  if (sector) facts.push(sector);
  const useClass = formatUseClassShort(listing.useClass);
  if (useClass) facts.push(useClass);
  if (facts.length) lines.push(facts.join(' · '));

  const points = (listing.keyPoints ?? [])
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 3);
  for (const point of points) {
    lines.push(`• ${point}`);
  }

  return appendListingUrl(lines.join('\n\n'), listingUrl);
}

export function linkedInAiSystemPrompt(): string {
  return `You write short LinkedIn company-page posts for a UK commercial property agency.
Return ONLY valid JSON: {"body":"..."}
Rules:
- 80–180 words. Agency tone: factual, professional, no hype.
- Include address/town, size (sq ft), tenure, rent and/or price (use POA if hidden), sector or use class when present.
- Include 1–3 key points from the listing only. Do not invent amenities, transport, or figures.
- No fake urgency ("act now", "won't last", "hurry").
- At most 3 relevant hashtags, or none. No hashtag spam.
- Put the public listing URL on its own last line when provided. If no URL, omit it.
- No emoji. No markdown headings. Plain text only.`;
}
