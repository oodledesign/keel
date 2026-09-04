/**
 * Workspace listing website URL templates for XML-only (and REST) agencies.
 *
 * Prefer storing the resolved URL on commercial_listings.website_url.
 * Templates fill empty website_url when the website feed is live.
 *
 * Placeholders:
 * - {slug} — address slug (line1 + line2 + town), WordPress-style
 * - {external_id} — listing feed / Kato reference
 * - {address_line_1_slug}, {address_line_2_slug}, {town_slug}, {postcode_slug}
 */

export type ListingWebsiteUrlFields = {
  externalId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  postcode?: string | null;
  name?: string | null;
};

const FEED_PATH_MARKERS = [
  '/api/commercial/property-hive-feed',
  '/api/commercial/each-feed',
];

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** True when URL is an Ozer XML feed (not a public property page). */
export function isCommercialFeedUrl(value: string): boolean {
  try {
    const path = new URL(value).pathname.toLowerCase();
    return FEED_PATH_MARKERS.some((marker) => path.includes(marker));
  } catch {
    return false;
  }
}

/** Public property page only — rejects feed URLs and non-http. */
export function isPublicListingPageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !isSafeHttpUrl(trimmed)) return false;
  if (isCommercialFeedUrl(trimmed)) return false;
  return true;
}

/** WordPress-ish sanitize_title for path segments. */
export function slugifyListingSegment(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Best-effort Property Hive / WP post slug from address fields.
 * Matches common Bracketts pattern: /property/{line1}-{line2}-{town}/
 */
export function buildListingAddressSlug(
  listing: ListingWebsiteUrlFields,
): string | null {
  const parts = [
    listing.addressLine1?.trim(),
    listing.addressLine2?.trim(),
    listing.town?.trim(),
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    const slug = slugifyListingSegment(parts.join(' '));
    if (slug) return slug;
  }

  const name = listing.name?.trim();
  if (name) {
    const slug = slugifyListingSegment(name);
    if (slug) return slug;
  }

  return null;
}

export function listingWebsiteUrlTemplateVars(
  listing: ListingWebsiteUrlFields,
): Record<string, string> {
  const slug = buildListingAddressSlug(listing) ?? '';
  return {
    slug,
    external_id: listing.externalId?.trim() ?? '',
    address_line_1_slug: listing.addressLine1?.trim()
      ? slugifyListingSegment(listing.addressLine1)
      : '',
    address_line_2_slug: listing.addressLine2?.trim()
      ? slugifyListingSegment(listing.addressLine2)
      : '',
    town_slug: listing.town?.trim() ? slugifyListingSegment(listing.town) : '',
    postcode_slug: listing.postcode?.trim()
      ? slugifyListingSegment(listing.postcode)
      : '',
  };
}

/**
 * Apply a workspace template. Returns null if any used placeholder is empty
 * or the result is not a safe public listing URL.
 */
export function applyListingWebsiteUrlTemplate(
  template: string | null | undefined,
  listing: ListingWebsiteUrlFields,
): string | null {
  const raw = template?.trim() ?? '';
  if (!raw) return null;

  const vars = listingWebsiteUrlTemplateVars(listing);
  let missing = false;
  const applied = raw.replace(/\{([a-z0-9_]+)\}/gi, (_match, key: string) => {
    const value = vars[key.toLowerCase()] ?? '';
    if (!value) missing = true;
    return value;
  });

  if (missing) return null;
  const url = applied.trim();
  if (!isPublicListingPageUrl(url)) return null;
  return url;
}

/**
 * Priority for a durable public listing CTA URL:
 * 1. Stored listing.website_url
 * 2. Live portal publication URL (Property Hive REST link, etc.) — not feed URLs
 * 3. Template-constructed URL (XML-only workspaces)
 */
export function resolveStoredOrTemplatedWebsiteUrl(input: {
  websiteUrl?: string | null;
  portalExternalUrl?: string | null;
  template?: string | null;
  listing: ListingWebsiteUrlFields;
}): string | null {
  const stored = input.websiteUrl?.trim() ?? '';
  if (stored && isPublicListingPageUrl(stored)) return stored;

  const portal = input.portalExternalUrl?.trim() ?? '';
  if (portal && isPublicListingPageUrl(portal)) return portal;

  return applyListingWebsiteUrlTemplate(input.template, input.listing);
}

export const LISTING_URL_TEMPLATE_META_KEY = 'listing_url_template';
