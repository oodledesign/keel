import { isPrivateOrReservedIp } from '~/lib/clients/client-logo-icons';
import {
  type ListingWebsiteUrlFields,
  buildListingAddressSlug,
  isPublicListingPageUrl,
  publicOriginFromHttpUrl,
  publicOriginFromListingUrlTemplate,
  slugifyListingSegment,
} from '~/lib/commercial/listing-website-url';

export type WordpressPropertyMatch = {
  id: number;
  slug: string;
  link: string;
  title: string;
};

export type WebsiteUrlResolveDeps = {
  fetch?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
};

const SEARCH_TIMEOUT_MS = 5_000;

function decodeTitle(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'rendered' in value) {
    return String((value as { rendered?: unknown }).rendered ?? '');
  }
  return '';
}

function isSameOriginPublicLink(link: string, origin: string): boolean {
  if (!isPublicListingPageUrl(link)) return false;
  try {
    return new URL(link).origin === origin;
  } catch {
    return false;
  }
}

function parsePropertyRecords(
  payload: unknown,
  origin: string,
): WordpressPropertyMatch[] {
  if (!Array.isArray(payload)) return [];
  const matches: WordpressPropertyMatch[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      id?: unknown;
      slug?: unknown;
      link?: unknown;
      title?: unknown;
    };
    const id = Number(row.id);
    const slug = typeof row.slug === 'string' ? row.slug : '';
    const link = typeof row.link === 'string' ? row.link : '';
    if (
      !Number.isFinite(id) ||
      !slug ||
      !isSameOriginPublicLink(link, origin)
    ) {
      continue;
    }
    matches.push({
      id,
      slug,
      link,
      title: decodeTitle(row.title),
    });
  }
  return matches;
}

export function listingWebsiteSlugCandidates(
  listing: ListingWebsiteUrlFields,
): string[] {
  const candidates = [
    buildListingAddressSlug(listing),
    listing.addressLine1 && listing.town
      ? slugifyListingSegment(`${listing.addressLine1} ${listing.town}`)
      : null,
    listing.addressLine1 ? slugifyListingSegment(listing.addressLine1) : null,
    listing.name ? slugifyListingSegment(listing.name) : null,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function listingWebsiteSearchTerms(
  listing: ListingWebsiteUrlFields,
): string[] {
  const terms = [
    listing.addressLine1?.trim(),
    listing.name?.trim(),
    [listing.addressLine1, listing.town].filter(Boolean).join(' ').trim(),
  ].filter((value): value is string => Boolean(value && value.length >= 4));
  return [...new Set(terms)];
}

export function scoreWordpressPropertyMatch(
  match: WordpressPropertyMatch,
  listing: ListingWebsiteUrlFields,
): number {
  const slug = match.slug.toLowerCase();
  const title = match.title.toLowerCase();
  const tokens = [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.name,
  ]
    .flatMap((value) =>
      value
        ? slugifyListingSegment(value)
            .split('-')
            .filter((token) => token.length > 2)
        : [],
    )
    .filter((token, index, all) => all.indexOf(token) === index);

  if (tokens.length === 0) return 0;

  let hits = 0;
  for (const token of tokens) {
    if (slug.includes(token) || title.includes(token)) hits += 1;
  }
  return hits / tokens.length;
}

export function pickConfidentWordpressMatch(
  matches: WordpressPropertyMatch[],
  listing: ListingWebsiteUrlFields,
): WordpressPropertyMatch | null {
  if (matches.length === 0) return null;
  const ranked = matches
    .map((match) => ({
      match,
      score: scoreWordpressPropertyMatch(match, listing),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.6) return null;
  const second = ranked[1];
  if (second && second.score >= best.score - 0.05 && second.score >= 0.6) {
    return null;
  }
  return best.match;
}

export function resolvePublicWebsiteSiteOrigin(input: {
  listingUrlTemplate?: string | null;
  propertyHiveSiteUrl?: string | null;
}): string | null {
  return (
    publicOriginFromListingUrlTemplate(input.listingUrlTemplate) ??
    publicOriginFromHttpUrl(input.propertyHiveSiteUrl ?? '')
  );
}

async function assertHostResolvesPublicly(
  url: string,
  resolveHost?: (hostname: string) => Promise<string[]>,
): Promise<boolean> {
  if (!resolveHost) return true;
  try {
    const { hostname } = new URL(url);
    const addresses = await resolveHost(hostname);
    return (
      addresses.length > 0 &&
      addresses.every((address) => !isPrivateOrReservedIp(address))
    );
  } catch {
    return false;
  }
}

async function fetchWordpressJson(
  url: string,
  fetchImpl: typeof fetch,
  resolveHost?: (hostname: string) => Promise<string[]>,
): Promise<unknown> {
  if (!(await assertHostResolvesPublicly(url, resolveHost))) return null;
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OzerPublishingHealth/1.0',
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Look up the live WP property page. Public REST does not expose PH
 * `external_id` / `ozer_listing_id` meta, so we match slug then title search.
 */
export async function lookupWordpressListingPageUrl(input: {
  siteOrigin: string;
  listing: ListingWebsiteUrlFields;
  deps?: WebsiteUrlResolveDeps;
}): Promise<string | null> {
  const origin = publicOriginFromHttpUrl(input.siteOrigin);
  if (!origin) return null;

  const fetchImpl = input.deps?.fetch ?? fetch;
  const resolveHost = input.deps?.resolveHost;
  const slugs = listingWebsiteSlugCandidates(input.listing);

  for (const slug of slugs) {
    const url = `${origin}/wp-json/wp/v2/property?slug=${encodeURIComponent(slug)}&_fields=id,link,slug,title&per_page=5`;
    try {
      const matches = parsePropertyRecords(
        await fetchWordpressJson(url, fetchImpl, resolveHost),
        origin,
      );
      const exact = matches.find((match) => match.slug === slug);
      if (exact) return exact.link;
      const confident = pickConfidentWordpressMatch(matches, input.listing);
      if (confident) return confident.link;
    } catch {
      // try the next candidate
    }
  }

  for (const term of listingWebsiteSearchTerms(input.listing)) {
    const url = `${origin}/wp-json/wp/v2/property?search=${encodeURIComponent(term)}&_fields=id,link,slug,title&per_page=5`;
    try {
      const matches = parsePropertyRecords(
        await fetchWordpressJson(url, fetchImpl, resolveHost),
        origin,
      );
      const confident = pickConfidentWordpressMatch(matches, input.listing);
      if (confident) return confident.link;
    } catch {
      // try the next term
    }
  }

  return null;
}
