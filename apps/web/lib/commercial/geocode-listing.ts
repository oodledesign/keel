/**
 * Forward-geocode a UK commercial address via Mapbox Geocoding API.
 * Uses NEXT_PUBLIC_MAPBOX_TOKEN (same token as the disposals map).
 *
 * Prefer postcode (most reliable), then town-anchored queries. Building names
 * like "Pickhill Business Centre" can otherwise match unrelated UK places.
 */
import 'server-only';

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string | null;
};

const MAX_TOWN_DISTANCE_KM = 40;

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

function buildCandidateQueries(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
}): string[] {
  const postcode = parts.postcode?.trim() || null;
  const town = parts.town?.trim() || null;
  const county = parts.county?.trim() || null;
  const line1 = parts.addressLine1?.trim() || null;
  const line2 = parts.addressLine2?.trim() || null;
  const country = parts.country?.trim() || 'United Kingdom';
  const queries: string[] = [];

  // 1) Postcode alone — best signal for UK stock.
  if (postcode) {
    queries.push(postcode);
    if (town) queries.push(`${postcode}, ${town}`);
  }

  // 2) Town-anchored full address (town before county/country).
  const townAnchored = [line1, line2, town, county, country]
    .filter(Boolean)
    .join(', ');
  if (townAnchored) queries.push(townAnchored);

  // 3) Town + county fallback when address lines are ambiguous place names.
  const townOnly = [town, county, country].filter(Boolean).join(', ');
  if (townOnly && townOnly !== townAnchored) queries.push(townOnly);

  return [...new Set(queries.filter(Boolean))];
}

async function mapboxGeocode(
  query: string,
  token: string,
): Promise<GeocodeResult | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,postcode,place,locality,neighborhood');

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error('[geocode] Mapbox error', res.status, await res.text());
      return null;
    }
    const body = (await res.json()) as {
      features?: Array<{
        place_name?: string;
        center?: [number, number];
      }>;
    };
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
    return {
      latitude,
      longitude,
      placeName: feature.place_name ?? null,
    };
  } catch (err) {
    console.error('[geocode] failed', err);
    return null;
  }
}

export async function geocodeListingAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
}): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (!token) return null;

  const queries = buildCandidateQueries(parts);
  if (queries.length === 0) return null;

  const town = parts.town?.trim();
  const county = parts.county?.trim();
  let townAnchor: GeocodeResult | null = null;
  if (town) {
    townAnchor = await mapboxGeocode(
      [town, county, 'United Kingdom'].filter(Boolean).join(', '),
      token,
    );
  }

  for (const query of queries) {
    const result = await mapboxGeocode(query, token);
    if (!result) continue;

    if (townAnchor && haversineKm(result, townAnchor) > MAX_TOWN_DISTANCE_KM) {
      // Reject matches that land far from the stated town (e.g. Pickhill, N. Yorks
      // when the disposal is in Tenterden).
      continue;
    }

    return result;
  }

  // Last resort: trust the town centre rather than a distant building-name hit.
  return townAnchor;
}

export function listingNeedsLocation(listing: {
  latitude: number | null;
  longitude: number | null;
}): boolean {
  return listing.latitude == null || listing.longitude == null;
}
