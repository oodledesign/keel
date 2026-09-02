/**
 * Nearby amenity labels for brochure map pages.
 * Uses Mapbox Geocoding (same token stack as listing geocode / static maps).
 */
import 'server-only';

import {
  type BrochureAmenityItem,
  buildFallbackNearbyAmenities,
  formatAmenityDistanceMiles,
  formatNearbyAmenityLabel,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

export type { BrochureAmenityItem } from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
export {
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

const POI_SEARCHES = [
  { query: 'railway station', suffix: 'station', limit: 1 },
  { query: 'supermarket', suffix: null, limit: 3 },
  { query: 'hospital', suffix: null, limit: 1 },
  { query: 'school', suffix: null, limit: 2 },
  { query: 'park', suffix: null, limit: 1 },
] as const;

function mapboxToken(): string | null {
  return (
    process.env.MAPBOX_SECRET_TOKEN?.trim() ||
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.MAPBOX_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    null
  );
}

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

function humanPoiName(text: string, suffix: string | null): string {
  const name = text.trim();
  if (!name) return '';
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

async function searchNearbyPois(
  query: string,
  origin: { latitude: number; longitude: number },
  token: string,
  limit: number,
): Promise<Array<{ name: string; km: number }>> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set(
    'limit',
    String(Math.min(POI_LIMIT, Math.max(1, limit))),
  );
  url.searchParams.set('types', 'poi');
  url.searchParams.set('proximity', `${origin.longitude},${origin.latitude}`);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.error(
        '[brochure-pdf] nearby amenities Mapbox',
        res.status,
        '— set MAPBOX_SECRET_TOKEN if NEXT_PUBLIC_MAPBOX_TOKEN is URL-restricted',
      );
    }
    return [];
  }

  const body = (await res.json()) as { features?: MapboxFeature[] };
  const hits: Array<{ name: string; km: number }> = [];

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

  return hits;
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

  const token = mapboxToken();
  if (!token) return fallback;

  try {
    const origin = {
      latitude: input.latitude,
      longitude: input.longitude,
    };
    const groups = await Promise.all(
      POI_SEARCHES.map(async (search) => {
        const hits = await searchNearbyPois(
          search.query,
          origin,
          token,
          search.limit,
        );
        return hits
          .map((hit) => {
            const name = humanPoiName(hit.name, search.suffix);
            if (!name) return null;
            return formatNearbyAmenityLabel(
              name,
              formatAmenityDistanceMiles(hit.km),
            );
          })
          .filter((label): label is string => Boolean(label));
      }),
    );

    const poiLabels = groups.flat();
    if (poiLabels.length === 0) return fallback;

    return buildFallbackNearbyAmenities(input.town, poiLabels).slice(
      0,
      MAX_AMENITIES,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[brochure-pdf] nearby amenities failed:', message);
    if (
      token === process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() &&
      (message.includes('401') || message.includes('403'))
    ) {
      console.error(
        '[brochure-pdf] Hint: NEXT_PUBLIC_MAPBOX_TOKEN may have URL restrictions. Set MAPBOX_SECRET_TOKEN for server-side geocoding.',
      );
    }
    return fallback;
  }
}
