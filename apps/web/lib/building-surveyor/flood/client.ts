import 'server-only';

import { extractUkPostcode, normalizeUkPostcode } from '../epc/parse';
import {
  buildFloodAssessment,
  floodBbox,
  isEnglandCountry,
  isNonEnglandUkCountry,
  normalizeCountryName,
  parseFloodMonitoringWarnings,
  parseOgcFloodZoneFeatures,
} from './parse';
import {
  EA_FLOOD_MONITORING_BASE_URL,
  EA_FLOOD_ZONES_COLLECTION,
  EA_FLOOD_ZONES_OGC_BASE_URL,
  ENGLAND_COUNTRY,
  FloodApiError,
  type FloodAssessment,
  type FloodCoordinates,
  POSTCODES_IO_BASE_URL,
} from './types';

const FETCH_MS = 12_000;
const ZONE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ZONE_CACHE_MAX = 200;
const FETCH_REVALIDATE_SECONDS = 6 * 60 * 60;
const EA_USER_AGENT =
  'OzerBuildingSurveyor/1.0 (Flood Map for Planning; https://github.com/oodledesign/keel)';

type ZoneCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

/** Process-local best-effort cache. Next.js `fetch` revalidate is the durable cache. */
const zoneQueryCache = new Map<string, ZoneCacheEntry>();

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': EA_USER_AGENT,
        ...headers,
      },
      next: { revalidate: FETCH_REVALIDATE_SECONDS },
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

function rememberZoneQuery(key: string, payload: unknown) {
  if (zoneQueryCache.size >= ZONE_CACHE_MAX) {
    const now = Date.now();
    for (const [cachedKey, entry] of zoneQueryCache) {
      if (entry.expiresAt <= now) zoneQueryCache.delete(cachedKey);
    }
    if (zoneQueryCache.size >= ZONE_CACHE_MAX) {
      const oldest = zoneQueryCache.keys().next().value;
      if (oldest) zoneQueryCache.delete(oldest);
    }
  }

  zoneQueryCache.set(key, {
    expiresAt: Date.now() + ZONE_CACHE_TTL_MS,
    payload,
  });
}

function zoneCacheKey(coordinates: FloodCoordinates) {
  return `${coordinates.longitude.toFixed(4)},${coordinates.latitude.toFixed(4)}`;
}

function coordinatesFromPostcodeResult(
  result: Record<string, unknown> | null,
  fallbackPostcode?: string | null,
): FloodCoordinates | null {
  if (!result) return null;
  const latitude = asFiniteNumber(result.latitude);
  const longitude = asFiniteNumber(result.longitude);
  if (latitude == null || longitude == null) return null;
  return {
    latitude,
    longitude,
    eastings: asFiniteNumber(result.eastings),
    northings: asFiniteNumber(result.northings),
    postcode:
      normalizeUkPostcode(
        typeof result.postcode === 'string'
          ? result.postcode
          : fallbackPostcode,
      ) ??
      fallbackPostcode ??
      null,
    country: normalizeCountryName(
      typeof result.country === 'string' ? result.country : null,
    ),
  };
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
    return coordinatesFromPostcodeResult(
      asRecord(asRecord(payload)?.result),
      normalized,
    );
  } catch {
    return null;
  }
}

export async function reverseGeocodeUkCoordinates(
  longitude: number,
  latitude: number,
): Promise<Pick<FloodCoordinates, 'country' | 'postcode'> | null> {
  try {
    const payload = await fetchJson(
      `${POSTCODES_IO_BASE_URL}/postcodes?lon=${longitude}&lat=${latitude}&limit=1`,
    );
    const result = asRecord(payload)?.result;
    const first = Array.isArray(result)
      ? asRecord(result[0])
      : asRecord(result);
    if (!first) return null;
    return {
      country: normalizeCountryName(
        typeof first.country === 'string' ? first.country : null,
      ),
      postcode: normalizeUkPostcode(
        typeof first.postcode === 'string' ? first.postcode : null,
      ),
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
    const reversed = await reverseGeocodeUkCoordinates(longitude, latitude);
    return {
      latitude,
      longitude,
      postcode:
        normalizeUkPostcode(input.postcode) ??
        extractUkPostcode(input.postcode) ??
        extractUkPostcode(input.address) ??
        reversed?.postcode ??
        null,
      country: reversed?.country ?? null,
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

async function queryPlanningFloodZones(
  coordinates: FloodCoordinates,
): Promise<unknown> {
  const key = zoneCacheKey(coordinates);
  const cached = zoneQueryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const bbox = floodBbox(coordinates.longitude, coordinates.latitude);
  // OGC bbox is comma-separated; do not encode the commas.
  const url = `${EA_FLOOD_ZONES_OGC_BASE_URL}/collections/${encodeURIComponent(
    EA_FLOOD_ZONES_COLLECTION,
  )}/items?bbox=${bbox}&limit=50`;
  const payload = await fetchJson(url, { Accept: 'application/geo+json' });
  rememberZoneQuery(key, payload);
  return payload;
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

export async function fetchPlanningFloodZones(input: {
  latitude?: number | null;
  longitude?: number | null;
  postcode?: string | null;
  address?: string | null;
}): Promise<FloodAssessment> {
  const coordinates = await resolveFloodCoordinates(input);

  if (isNonEnglandUkCountry(coordinates.country)) {
    return buildFloodAssessment({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      postcode: coordinates.postcode,
      country: coordinates.country,
      zoneHits: [],
      highestIntersectedZone: null,
      liveWarnings: [],
      endpoint: EA_FLOOD_ZONES_OGC_BASE_URL,
    });
  }

  const [payload, liveWarnings] = await Promise.all([
    queryPlanningFloodZones(coordinates),
    queryLiveWarnings(coordinates),
  ]);
  const parsed = parseOgcFloodZoneFeatures(payload);

  return buildFloodAssessment({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    postcode: coordinates.postcode,
    country: isEnglandCountry(coordinates.country)
      ? coordinates.country
      : parsed.highestZone
        ? ENGLAND_COUNTRY
        : coordinates.country,
    zoneHits: parsed.hits,
    highestIntersectedZone: parsed.highestZone,
    liveWarnings,
    endpoint: EA_FLOOD_ZONES_OGC_BASE_URL,
  });
}

/** @deprecated Use fetchPlanningFloodZones — Flood Map for Planning, not NaFRA. */
export const fetchLongTermFloodRisk = fetchPlanningFloodZones;
