/**
 * Environment Agency flood-zone lookup (server-only, no API key).
 *
 * Primary: Flood Map for Planning WFS (rivers and sea Zones 2 and 3).
 * A point in Zone 3 → Zone 3; else Zone 2 → Zone 2; else Zone 1.
 * Supplementary: flood-monitoring `/id/floods` for current warnings within 2 km.
 *
 * See PR notes — this is the official open-data flood-zone source used for
 * planning, which matches RICS Risks-section language (Flood Zone 1 / 2 / 3).
 */
import 'server-only';

import { combineFloodLookup } from './parse';
import {
  EA_FLOOD_MAP_ZONE_2_WFS,
  EA_FLOOD_MAP_ZONE_3_WFS,
  EA_FLOOD_MONITORING_FLOODS_URL,
  FloodApiError,
  type FloodLookupResult,
} from './types';

const FETCH_TIMEOUT_MS = 8_000;
const POINT_BBOX_DEG = 0.00025;

function bboxForPoint(latitude: number, longitude: number): string {
  const d = POINT_BBOX_DEG;
  return `${longitude - d},${latitude - d},${longitude + d},${latitude + d},EPSG:4326`;
}

function wfsUrl(base: string, typeNames: string, bbox: string): string {
  const url = new URL(base);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeNames', typeNames);
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('srsName', 'EPSG:4326');
  url.searchParams.set('bbox', bbox);
  url.searchParams.set('count', '1');
  return url.toString();
}

async function fetchJson(url: string, label: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new FloodApiError(
        res.status,
        `Flood data is temporarily unavailable (${label}).`,
      );
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      const text = await res.text();
      if (
        text.includes('ExceptionReport') ||
        text.includes('ServiceException')
      ) {
        return { type: 'FeatureCollection', features: [] };
      }
      throw new FloodApiError(
        502,
        `Flood data returned an unexpected ${label} response.`,
      );
    }
    return (await res.json()) as unknown;
  } catch (error) {
    if (error instanceof FloodApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FloodApiError(
        504,
        'Flood lookup timed out. Try again in a moment.',
      );
    }
    throw new FloodApiError(502, 'Flood data is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWfsZone(
  base: string,
  typeNames: string[],
  bbox: string,
  label: string,
): Promise<unknown> {
  let lastError: unknown;
  for (const typeName of typeNames) {
    try {
      return await fetchJson(wfsUrl(base, typeName, bbox), label);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof FloodApiError
    ? lastError
    : new FloodApiError(502, 'Flood data is temporarily unavailable.');
}

export async function fetchEaFloodLookup(input: {
  latitude: number;
  longitude: number;
}): Promise<FloodLookupResult> {
  const { latitude, longitude } = input;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 49 ||
    latitude > 61 ||
    longitude < -9 ||
    longitude > 3
  ) {
    throw new FloodApiError(
      400,
      'Confirm a UK address with a map pin before fetching flood risk.',
    );
  }

  const bbox = bboxForPoint(latitude, longitude);
  const warningsUrl = new URL(EA_FLOOD_MONITORING_FLOODS_URL);
  warningsUrl.searchParams.set('lat', String(latitude));
  warningsUrl.searchParams.set('long', String(longitude));
  warningsUrl.searchParams.set('dist', '2');

  const [zone3, zone2, warnings] = await Promise.all([
    fetchWfsZone(
      EA_FLOOD_MAP_ZONE_3_WFS,
      [
        'ms:Flood_Map_for_Planning_Rivers_And_Sea_Flood_Zone_3',
        'Flood_Map_for_Planning_Rivers_And_Sea_Flood_Zone_3',
      ],
      bbox,
      'Zone 3',
    ),
    fetchWfsZone(
      EA_FLOOD_MAP_ZONE_2_WFS,
      [
        'ms:Flood_Map_for_Planning_Rivers_And_Sea_Flood_Zone_2',
        'Flood_Map_for_Planning_Rivers_And_Sea_Flood_Zone_2',
      ],
      bbox,
      'Zone 2',
    ),
    fetchJson(warningsUrl.toString(), 'warnings').catch(() => ({ items: [] })),
  ]);

  return combineFloodLookup({ zone3, zone2, warnings });
}
