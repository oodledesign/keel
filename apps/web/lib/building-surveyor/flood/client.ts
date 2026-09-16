import 'server-only';

import { extractUkPostcode, normalizeUkPostcode } from '../epc/parse';
import {
  buildFloodAssessment,
  floodBbox,
  parseFloodMonitoringWarnings,
  parseOgcFeatureCount,
} from './parse';
import {
  EA_FLOOD_MONITORING_BASE_URL,
  EA_LONG_TERM_FLOOD_OGC_BASE_URL,
  EA_RIVERS_SEA_COLLECTIONS,
  FloodApiError,
  type FloodAssessment,
  type FloodCoordinates,
  type FloodLayerHit,
  POSTCODES_IO_BASE_URL,
} from './types';

const FETCH_MS = 12_000;

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_MS),
    });
  } catch {
    throw new FloodApiError(500, 'Could not reach the flood-risk service.');
  }

  if (!response.ok) {
    throw new FloodApiError(
      response.status,
      'The flood-risk service returned an error.',
    );
  }

  return response.json();
}

/** Fallback geocoder when Mapbox coords are missing. Failures return null. */
export async function geocodeUkPostcode(
  postcode: string,
): Promise<FloodCoordinates | null> {
  const normalized =
    normalizeUkPostcode(postcode) ?? extractUkPostcode(postcode);
  if (!normalized) return null;

  try {
    const payload = await fetchJson(
      `${POSTCODES_IO_BASE_URL}/postcodes/${encodeURIComponent(normalized)}`,
    );
    const result =
      payload && typeof payload === 'object'
        ? (payload as { result?: Record<string, unknown> }).result
        : null;
    const latitude = asFiniteNumber(result?.latitude);
    const longitude = asFiniteNumber(result?.longitude);
    if (latitude == null || longitude == null) return null;
    return {
      latitude,
      longitude,
      eastings: asFiniteNumber(result?.eastings),
      northings: asFiniteNumber(result?.northings),
      postcode: normalized,
    };
  } catch {
    return null;
  }
}

export async function resolveFloodCoordinates(input: {
  latitude?: number | null;
  longitude?: number | null;
  postcode?: string | null;
  address?: string | null;
}): Promise<FloodCoordinates> {
  const latitude = asFiniteNumber(input.latitude);
  const longitude = asFiniteNumber(input.longitude);
  if (latitude != null && longitude != null) {
    return {
      latitude,
      longitude,
      postcode:
        normalizeUkPostcode(input.postcode) ??
        extractUkPostcode(input.postcode) ??
        extractUkPostcode(input.address),
    };
  }

  const postcode =
    normalizeUkPostcode(input.postcode) ??
    extractUkPostcode(input.postcode) ??
    extractUkPostcode(input.address);
  if (!postcode) {
    throw new FloodApiError(
      400,
      'Add a postcode or choose an address suggestion before pulling flood risk.',
    );
  }

  const geocoded = await geocodeUkPostcode(postcode);
  if (!geocoded) {
    throw new FloodApiError(
      404,
      'Could not locate that postcode for a flood-risk lookup.',
    );
  }
  return geocoded;
}

async function queryRiversAndSeaLayer(
  collection: string,
  coordinates: FloodCoordinates,
): Promise<FloodLayerHit | null> {
  const bbox = floodBbox(coordinates.longitude, coordinates.latitude);
  const url = `${EA_LONG_TERM_FLOOD_OGC_BASE_URL}/collections/${encodeURIComponent(
    collection,
  )}/items?bbox=${encodeURIComponent(bbox)}&limit=1`;
  const payload = await fetchJson(url, { Accept: 'application/geo+json' });
  const parsed = parseOgcFeatureCount(payload);
  if (!parsed.hit) return null;
  return { collection, floodSource: parsed.floodSource };
}

async function queryLiveWarnings(
  coordinates: FloodCoordinates,
): Promise<ReturnType<typeof parseFloodMonitoringWarnings>> {
  const url = `${EA_FLOOD_MONITORING_BASE_URL}/id/floods?lat=${coordinates.latitude}&long=${coordinates.longitude}&dist=3`;
  try {
    const payload = await fetchJson(url);
    return parseFloodMonitoringWarnings(payload);
  } catch {
    return [];
  }
}

export async function fetchLongTermFloodRisk(input: {
  latitude?: number | null;
  longitude?: number | null;
  postcode?: string | null;
  address?: string | null;
}): Promise<FloodAssessment> {
  const coordinates = await resolveFloodCoordinates(input);

  const [medium, low, liveWarnings] = await Promise.all([
    queryRiversAndSeaLayer(EA_RIVERS_SEA_COLLECTIONS.medium, coordinates),
    queryRiversAndSeaLayer(EA_RIVERS_SEA_COLLECTIONS.low, coordinates),
    queryLiveWarnings(coordinates),
  ]);

  return buildFloodAssessment({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    postcode: coordinates.postcode,
    layers: [medium, low].filter((item): item is FloodLayerHit => item != null),
    liveWarnings,
    endpoint: EA_LONG_TERM_FLOOD_OGC_BASE_URL,
  });
}
