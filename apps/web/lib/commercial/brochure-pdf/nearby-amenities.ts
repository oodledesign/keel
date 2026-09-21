/**
 * Nearby amenity labels for brochure map pages.
 * Uses Mapbox Geocoding (same token stack as listing geocode / static maps).
 */
import 'server-only';

import {
  type ResolvedMapboxToken,
  isPublicMapboxTokenSource,
  listMapboxTokens,
  logMapboxServerAuthFailure,
} from '~/lib/commercial/brochure-pdf/mapbox-token';
import {
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
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

const MAX_AMENITIES = 8;
const MAX_DISTANCE_KM = 12;
const POI_LIMIT = 5;

type PoiSearch = {
  queries: readonly string[];
  suffix: string | null;
  take: number;
  reject?: RegExp;
};

const POI_SEARCHES: readonly PoiSearch[] = [
  {
    queries: ['railway station', 'train station'],
    suffix: 'station',
    take: 1,
  },
  {
    queries: ['supermarket', 'grocery'],
    suffix: null,
    take: 3,
  },
  { queries: ['hospital'], suffix: null, take: 1 },
  {
    queries: ['school'],
    suffix: null,
    take: 2,
    reject: /\bdriving school\b/i,
  },
  {
    queries: ['park'],
    suffix: null,
    take: 1,
    reject: /\b(car park|parking|park and ride)\b/i,
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

function humanPoiName(text: string, suffix: string | null): string {
  let name = text.trim();
  if (!name) return '';
  if (suffix === 'station') {
    name = name.replace(/\s+(?:railway|train)\s+station$/i, ' station');
  }
  if (suffix && !new RegExp(suffix, 'i').test(name)) {
    return `${name} ${suffix}`;
  }
  return name;
}

type MapboxFeature = {
  text?: string;
  place_name?: string;
  center?: [number, number];
};

type PoiHit = { name: string; km: number };

type SearchOutcome = {
  hits: PoiHit[];
  authFailed: boolean;
  status?: number;
};

async function searchNearbyPois(
  query: string,
  origin: { latitude: number; longitude: number },
  resolved: ResolvedMapboxToken,
  limit: number,
): Promise<SearchOutcome> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', resolved.token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set(
    'limit',
    String(Math.min(POI_LIMIT, Math.max(1, limit))),
  );
  url.searchParams.set('types', 'poi');
  url.searchParams.set('proximity', `${origin.longitude},${origin.latitude}`);
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('language', 'en');
  url.searchParams.set('bbox', proximityBbox(origin, MAX_DISTANCE_KM));

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
      `query="${query}"`,
      `tokenSource=${resolved.source}`,
      `tokenIsPublic=${isPublicMapboxTokenSource(resolved.source)}`,
    );
    return { hits: [], authFailed: false };
  }

  const body = (await res.json()) as { features?: MapboxFeature[] };
  const hits: PoiHit[] = [];

  for (const feature of body.features ?? []) {
    const center = feature.center;
    if (!center || center.length < 2) continue;

    const [longitude, latitude] = center;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const km = haversineKm(origin, { latitude, longitude });
    if (km > MAX_DISTANCE_KM) continue;

    const name =
      feature.text?.trim() || feature.place_name?.split(',')[0]?.trim();
    if (!name) continue;
    hits.push({ name, km });
  }

  hits.sort((a, b) => a.km - b.km);
  return { hits, authFailed: false };
}

function labelsFromHits(hits: PoiHit[], search: PoiSearch): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const hit of hits) {
    if (search.reject?.test(hit.name)) continue;
    const name = humanPoiName(hit.name, search.suffix);
    if (!name) continue;
    const key = amenityDedupeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(
      formatNearbyAmenityLabel(name, formatAmenityDistanceMiles(hit.km)),
    );
    if (labels.length >= search.take) break;
  }

  return labels;
}

async function fetchAmenitiesWithToken(
  origin: { latitude: number; longitude: number },
  resolved: ResolvedMapboxToken,
): Promise<{ labels: string[]; authFailed: boolean; status?: number }> {
  const groups = await Promise.all(
    POI_SEARCHES.map(async (search) => {
      const outcomes = await Promise.all(
        search.queries.map((query) =>
          searchNearbyPois(query, origin, resolved, POI_LIMIT),
        ),
      );
      const authFailure = outcomes.find((outcome) => outcome.authFailed);
      if (authFailure) {
        return {
          labels: [] as string[],
          authFailed: true,
          status: authFailure.status,
        };
      }
      const mergedHits = outcomes
        .flatMap((outcome) => outcome.hits)
        .sort((a, b) => a.km - b.km);
      return {
        labels: labelsFromHits(mergedHits, search),
        authFailed: false,
      };
    }),
  );

  const authFailure = groups.find((group) => group.authFailed);
  if (authFailure) {
    return { labels: [], authFailed: true, status: authFailure.status };
  }

  return { labels: groups.flatMap((group) => group.labels), authFailed: false };
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

      if (result.labels.length === 0) {
        console.warn(
          '[brochure-pdf] nearby amenities: Mapbox returned no POIs within range; using town-centre fallback',
          `tokenSource=${resolved.source}`,
        );
        return fallback;
      }

      return buildFallbackNearbyAmenities(input.town, result.labels).slice(
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
