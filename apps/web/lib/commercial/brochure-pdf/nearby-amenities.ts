/**
 * Nearby amenities (label, pin coordinates, icon) for brochure map pages.
 * Uses Mapbox Search Box category search (same token stack as static maps).
 */
import 'server-only';

import {
  type ResolvedMapboxToken,
  isPublicMapboxTokenSource,
  listMapboxTokens,
  logMapboxServerAuthFailure,
} from '~/lib/commercial/brochure-pdf/mapbox-token';
import {
  type AmenityIcon,
  type BrochureAmenityItem,
  amenityDedupeKey,
  buildFallbackNearbyAmenities,
  formatAmenityDistanceMiles,
  formatNearbyAmenityLabel,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

export type { BrochureAmenityItem } from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
export {
  amenityDedupeKey,
  buildFallbackNearbyAmenities,
  formatAmenityDistanceMiles,
  formatNearbyAmenityLabel,
  isDummyLocalAreaAmenity,
  isThinNearbyAmenityList,
  isTownCentreAmenity,
  mergeBrochureAmenities,
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

const MAX_AMENITIES = 8;
const RESULTS_PER_CATEGORY = 10;

type PoiSearch = {
  /** Mapbox Search Box canonical category id. */
  category: string;
  icon: AmenityIcon;
  take: number;
  maxKm: number;
  /** Mapbox sub-categories to leave out (nurseries, driving schools…). */
  excludeCategories?: readonly string[];
  /** Name must match, when set. */
  accept?: RegExp;
  reject?: RegExp;
};

/**
 * Category search returns everything Mapbox tags under a category — e.g. a
 * supermarket's in-store bank, nurseries as "school", a hospital's charity
 * office — so each search filters names. Stations come from NaPTAN instead
 * (Mapbox's railway_station category misses smaller stations).
 */
const POI_SEARCHES: readonly PoiSearch[] = [
  {
    category: 'supermarket',
    icon: 'grocery',
    take: 2,
    maxKm: 5,
    // Recognised chains only — independents are mostly mis-tagged shops.
    accept:
      /\b(tesco|sainsbury'?s|asda|morrisons|waitrose|aldi|lidl|co-?op|m&s|marks (and|&) spencer|iceland|budgens|spar|nisa|londis|one stop|costcutter|farmfoods|booths|whole foods|premier)\b/i,
    reject:
      /\b(bank|travel money|petrol|fuel|pharmacy|caf[eé]|car wash|inn|hotel)\b/i,
  },
  {
    category: 'school',
    icon: 'school',
    take: 2,
    maxKm: 3,
    excludeCategories: [
      'kindergarten',
      'language_school',
      'music_school',
      'driving_school',
    ],
    accept: /\b(school|academy|college)\b/i,
    reject:
      /\b(nursery|pre-?school|childcare|montessori|driving|language|music|dance|drama|stage|tuition|tutors?|swim\w*|makeup|beauty|hair|yoga|martial|karate|taekwondo|judo|boxing|kickboxing|ballet|gym|fitness|football|sports?)\b|\bacademy of\b/i,
  },
  {
    category: 'park',
    icon: 'park',
    take: 1,
    maxKm: 3,
    accept:
      /\b(park|recreation ground|common|green|gardens?|grounds|meadows?|woods?|heath|nature reserve)\b/i,
    reject:
      /\b(entrance|car park|parking|park and ride|playground|golf|tennis|cricket|bowls|club)\b/i,
  },
  {
    category: 'hospital',
    icon: 'hospital',
    take: 1,
    maxKm: 12,
    accept: /\bhospital\b/i,
    reject:
      /\b(friends of|league of|charity|shop|radio|hospice|department|unit|ward|wing|clinic|emergency)\b/i,
  },
];

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function proximityBbox(
  origin: { latitude: number; longitude: number },
  km: number,
): string {
  const latDelta = km / 111.32;
  const lngDenom = 111.32 * Math.cos((origin.latitude * Math.PI) / 180);
  const lngDelta = lngDenom === 0 ? km / 111.32 : km / lngDenom;
  const minLon = Math.max(-180, origin.longitude - lngDelta);
  const minLat = Math.max(-90, origin.latitude - latDelta);
  const maxLon = Math.min(180, origin.longitude + lngDelta);
  const maxLat = Math.min(90, origin.latitude + latDelta);
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

type CategoryFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; brand?: string[] | null };
};

type PoiHit = {
  name: string;
  brand: string | null;
  km: number;
  latitude: number;
  longitude: number;
};

type PoiAmenity = Omit<BrochureAmenityItem, 'index'>;

type SearchOutcome = {
  hits: PoiHit[];
  authFailed: boolean;
  status?: number;
};

async function searchCategory(
  search: PoiSearch,
  origin: { latitude: number; longitude: number },
  resolved: ResolvedMapboxToken,
): Promise<SearchOutcome> {
  const url = new URL(
    `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(search.category)}`,
  );
  url.searchParams.set('access_token', resolved.token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(RESULTS_PER_CATEGORY));
  url.searchParams.set('proximity', `${origin.longitude},${origin.latitude}`);
  url.searchParams.set('bbox', proximityBbox(origin, search.maxKm));
  url.searchParams.set('exclude_fields', 'photos,reviews');
  if (search.excludeCategories?.length) {
    url.searchParams.set(
      'poi_category_exclusions',
      search.excludeCategories.join(','),
    );
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { hits: [], authFailed: true, status: res.status };
    }
    console.error(
      '[brochure-pdf] nearby amenities Mapbox',
      res.status,
      `category=${search.category}`,
      `tokenSource=${resolved.source}`,
      `tokenIsPublic=${isPublicMapboxTokenSource(resolved.source)}`,
    );
    return { hits: [], authFailed: false };
  }

  const body = (await res.json()) as { features?: CategoryFeature[] };
  const hits: PoiHit[] = [];

  for (const feature of body.features ?? []) {
    const [longitude, latitude] = feature.geometry?.coordinates ?? [];
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const km = haversineKm(origin, { latitude, longitude });
    if (km > search.maxKm) continue;

    const name = feature.properties?.name?.trim();
    if (!name) continue;
    const brand = feature.properties?.brand?.[0]?.trim().toLowerCase() || null;
    hits.push({ name, brand, km, latitude, longitude });
  }

  hits.sort((a, b) => a.km - b.km);
  return { hits, authFailed: false };
}

function amenitiesFromHits(hits: PoiHit[], search: PoiSearch): PoiAmenity[] {
  const seen = new Set<string>();
  const amenities: PoiAmenity[] = [];

  for (const hit of hits) {
    if (search.accept && !search.accept.test(hit.name)) continue;
    if (search.reject?.test(hit.name)) continue;
    const key = amenityDedupeKey(hit.name);
    // One branch per chain: Sainsbury's and Sainsbury's Local share a brand.
    const brandKey = hit.brand ? `brand:${hit.brand}` : null;
    if (!key || seen.has(key) || (brandKey && seen.has(brandKey))) continue;
    seen.add(key);
    if (brandKey) seen.add(brandKey);
    amenities.push({
      label: formatNearbyAmenityLabel(
        hit.name,
        formatAmenityDistanceMiles(hit.km),
      ),
      latitude: hit.latitude,
      longitude: hit.longitude,
      icon: search.icon,
    });
    if (amenities.length >= search.take) break;
  }

  return amenities;
}

/** First of each category, then seconds, so a capped list stays varied. */
function interleave<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i++) {
    for (const group of groups) {
      const item = group[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

async function fetchAmenitiesWithToken(
  origin: { latitude: number; longitude: number },
  resolved: ResolvedMapboxToken,
): Promise<{ amenities: PoiAmenity[]; authFailed: boolean; status?: number }> {
  const outcomes = await Promise.all(
    POI_SEARCHES.map((search) =>
      searchCategory(search, origin, resolved).catch(
        (err: unknown): SearchOutcome => {
          console.error(
            '[brochure-pdf] nearby amenities failed:',
            `category=${search.category}`,
            err instanceof Error ? err.message : String(err),
          );
          return { hits: [], authFailed: false };
        },
      ),
    ),
  );

  const authFailure = outcomes.find((outcome) => outcome.authFailed);
  if (authFailure) {
    return { amenities: [], authFailed: true, status: authFailure.status };
  }

  return {
    amenities: interleave(
      outcomes.map((outcome, i) =>
        amenitiesFromHits(outcome.hits, POI_SEARCHES[i]!),
      ),
    ),
    authFailed: false,
  };
}

/**
 * Fetch a short list of nearby human-labelled places. On failure, town centre only.
 */
export async function fetchNearbyBrochureAmenities(input: {
  latitude: number;
  longitude: number;
  town?: string | null;
}): Promise<BrochureAmenityItem[]> {
  const fallback = buildFallbackNearbyAmenities(input.town);
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return fallback;
  }

  const tokens = listMapboxTokens();
  if (tokens.length === 0) {
    console.warn(
      '[brochure-pdf] nearby amenities skipped: no Mapbox token. Set MAPBOX_SECRET_TOKEN (preferred, unrestricted) or NEXT_PUBLIC_MAPBOX_TOKEN',
    );
    return fallback;
  }

  try {
    const origin = {
      latitude: input.latitude,
      longitude: input.longitude,
    };

    for (const resolved of tokens) {
      const result = await fetchAmenitiesWithToken(origin, resolved);
      if (result.authFailed) {
        logMapboxServerAuthFailure(
          resolved.source,
          result.status ?? 401,
          'nearby amenities',
        );
        continue;
      }

      if (result.amenities.length === 0) {
        console.warn(
          '[brochure-pdf] nearby amenities: Mapbox returned no POIs within range; using town-centre fallback',
          `tokenSource=${resolved.source}`,
        );
        return fallback;
      }

      return buildFallbackNearbyAmenities(input.town, result.amenities).slice(
        0,
        MAX_AMENITIES,
      );
    }

    console.warn(
      '[brochure-pdf] nearby amenities: every Mapbox token was rejected; using town-centre fallback',
    );
    return fallback;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const preferred = tokens[0];
    console.error('[brochure-pdf] nearby amenities failed:', message);
    // Last resort: unexpected throw with a status in the message. HTTP 401/403
    // from Mapbox is handled via authFailed and never reaches this catch.
    if (
      preferred &&
      isPublicMapboxTokenSource(preferred.source) &&
      (message.includes('401') || message.includes('403'))
    ) {
      logMapboxServerAuthFailure(preferred.source, 401, 'nearby amenities');
    }
    return fallback;
  }
}
