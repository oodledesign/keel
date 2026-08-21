/**
 * UK address autocomplete via Mapbox Geocoding (same token as disposals map).
 */
import 'server-only';

import type { AddressSuggestion } from './address-suggest.types';

export type { AddressSuggestion } from './address-suggest.types';

type MapboxContextItem = {
  id: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id: string;
  place_name?: string;
  text?: string;
  address?: string;
  place_type?: string[];
  center?: [number, number];
  context?: MapboxContextItem[];
};

function mapboxToken(): string | null {
  return (
    process.env.MAPBOX_SECRET_TOKEN?.trim() ||
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.MAPBOX_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    null
  );
}

function contextText(
  context: MapboxContextItem[] | undefined,
  prefix: string,
): string | null {
  const hit = context?.find((item) => item.id.startsWith(prefix));
  return hit?.text?.trim() || null;
}

export function parseMapboxAddressFeature(
  feature: MapboxFeature,
): AddressSuggestion | null {
  const center = feature.center;
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

  const types = feature.place_type ?? [];
  const isPostcode = types.includes('postcode');
  const isAddress = types.includes('address');
  const isPoi = types.includes('poi');

  const postcode = isPostcode
    ? (feature.text?.trim() ?? null)
    : contextText(feature.context, 'postcode.');
  const town =
    contextText(feature.context, 'place.') ??
    contextText(feature.context, 'locality.') ??
    contextText(feature.context, 'district.');
  const region = contextText(feature.context, 'region.');
  const district = contextText(feature.context, 'district.');
  const county =
    district && district.toLowerCase() !== town?.toLowerCase()
      ? district
      : region;

  let addressLine1: string | null = null;
  let addressLine2: string | null = null;
  let nameHint: string | null = null;

  if (isAddress) {
    addressLine1 = [feature.address, feature.text]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
    nameHint = addressLine1;
  } else if (isPoi) {
    nameHint = feature.text?.trim() || null;
    addressLine1 = feature.text?.trim() || null;
    // Mapbox often puts the street in place_name after the POI name.
    const placeName = feature.place_name?.trim() ?? '';
    const afterComma = placeName.split(',').slice(1).map((p) => p.trim());
    if (afterComma[0] && afterComma[0] !== town && afterComma[0] !== postcode) {
      addressLine2 = afterComma[0];
    }
  } else if (!isPostcode) {
    addressLine1 = feature.text?.trim() || null;
    nameHint = addressLine1;
  }

  return {
    id: feature.id,
    label: feature.place_name?.trim() || feature.text?.trim() || feature.id,
    nameHint,
    addressLine1,
    addressLine2,
    town,
    county,
    postcode,
    country: 'GB',
    latitude,
    longitude,
  };
}

export async function suggestUkAddresses(
  query: string,
  limit = 6,
): Promise<AddressSuggestion[]> {
  const token = mapboxToken();
  const trimmed = query.trim();
  if (!token || trimmed.length < 3) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'GB');
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 10)));
  url.searchParams.set(
    'types',
    'address,poi,postcode,place,locality,neighborhood',
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error('[address-suggest] Mapbox error', res.status, await res.text());
    return [];
  }

  const body = (await res.json()) as { features?: MapboxFeature[] };
  const suggestions: AddressSuggestion[] = [];
  for (const feature of body.features ?? []) {
    const parsed = parseMapboxAddressFeature(feature);
    if (parsed) suggestions.push(parsed);
  }
  return suggestions;
}
