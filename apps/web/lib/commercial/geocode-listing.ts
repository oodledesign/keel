/**
 * Forward-geocode a UK commercial address via Mapbox Geocoding API.
 * Uses NEXT_PUBLIC_MAPBOX_TOKEN (same token as the disposals map).
 */

import 'server-only';

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string | null;
};

function buildAddressQuery(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
}): string | null {
  const postcode = parts.postcode?.trim();
  if (postcode) {
    // Postcode-first queries are more reliable for UK stock.
    const rest = [parts.addressLine1, parts.town, parts.county]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(', ');
    return rest ? `${postcode}, ${rest}` : postcode;
  }

  const query = [
    parts.addressLine1,
    parts.addressLine2,
    parts.town,
    parts.county,
    parts.country ?? 'United Kingdom',
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');

  return query || null;
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

  const query = buildAddressQuery(parts);
  if (!query) return null;

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

export function listingNeedsLocation(listing: {
  latitude: number | null;
  longitude: number | null;
}): boolean {
  return listing.latitude == null || listing.longitude == null;
}
