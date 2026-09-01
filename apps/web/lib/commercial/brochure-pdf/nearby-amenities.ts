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
  sanitizeBrochureAmenities,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

const MAX_AMENITIES = 6;
const MAX_DISTANCE_KM = 12;

const POI_SEARCHES = [
  { query: 'railway station', suffix: 'station' },
  { query: 'supermarket', suffix: null },
  { query: 'school', suffix: null },
  { query: 'hospital', suffix: null },
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

async function searchNearbyPoi(
  query: string,
  origin: { latitude: number; longitude: number },
  token: string,
): Promise<{ name: string; km: number } | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'poi');
  url.searchParams.set(
    'proximity',
    `${origin.longitude},${origin.latitude}`,
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { features?: MapboxFeature[] };
  const feature = body.features?.[0];
  const center = feature?.center;
  if (!center || center.length < 2) return null;

  const [longitude, latitude] = center;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const km = haversineKm(origin, { latitude, longitude });
  if (km > MAX_DISTANCE_KM) return null;

  const name = feature.text?.trim() || feature.place_name?.split(',')[0]?.trim();
  if (!name) return null;
  return { name, km };
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
    const hits = await Promise.all(
      POI_SEARCHES.map(async (search) => {
        const hit = await searchNearbyPoi(search.query, origin, token);
        if (!hit) return null;
        const name = humanPoiName(hit.name, search.suffix);
        if (!name) return null;
        return formatNearbyAmenityLabel(
          name,
          formatAmenityDistanceMiles(hit.km),
        );
      }),
    );

    const seen = new Set<string>();
    const amenities: BrochureAmenityItem[] = [];
    for (const label of hits) {
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      amenities.push({ label, index: amenities.length + 1 });
      if (amenities.length >= MAX_AMENITIES) break;
    }

    return amenities.length > 0 ? amenities : fallback;
  } catch (err) {
    console.error(
      '[brochure-pdf] nearby amenities failed:',
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}
