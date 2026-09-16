import {
  FLOOD_ZONES,
  type FloodLookupResult,
  type FloodWarningSummary,
  type FloodZone,
} from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function isFloodZone(
  value: string | null | undefined,
): value is FloodZone {
  return value === '1' || value === '2' || value === '3';
}

export function normalizeFloodZone(value: unknown): FloodZone | null {
  if (value == null || value === '') return null;
  const digits = String(value).replace(/[^\d]/g, '');
  if (digits === '1' || digits === '2' || digits === '3') return digits;
  const lower = String(value).toLowerCase();
  if (lower.includes('zone 3') || lower.includes('floodzone3')) return '3';
  if (lower.includes('zone 2') || lower.includes('floodzone2')) return '2';
  if (lower.includes('zone 1') || lower.includes('floodzone1')) return '1';
  return null;
}

export function riversAndSeaFromZone(zone: FloodZone): string {
  if (zone === '3') return 'High';
  if (zone === '2') return 'Medium';
  return 'Low';
}

export function floodZoneSummary(zone: FloodZone, warningCount = 0): string {
  const zoneCopy =
    zone === '3'
      ? 'Flood Zone 3 — high probability of flooding from rivers or the sea.'
      : zone === '2'
        ? 'Flood Zone 2 — medium probability of flooding from rivers or the sea.'
        : 'Flood Zone 1 — low probability of flooding from rivers or the sea.';

  if (warningCount <= 0) {
    return `${zoneCopy} No current Environment Agency flood warnings nearby.`;
  }

  return `${zoneCopy} ${warningCount} current Environment Agency flood warning${
    warningCount === 1 ? '' : 's'
  } within 2 km.`;
}

function featureCollectionLength(value: unknown): number {
  const record = asRecord(value);
  if (!record) return 0;

  const features = record.features;
  if (Array.isArray(features)) return features.length;

  const numberMatched = record.numberMatched ?? record.totalFeatures;
  if (typeof numberMatched === 'number' && Number.isFinite(numberMatched)) {
    return numberMatched;
  }
  if (typeof numberMatched === 'string' && numberMatched.trim()) {
    const parsed = Number(numberMatched);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function wfsHasIntersectingFeatures(value: unknown): boolean {
  return featureCollectionLength(value) > 0;
}

export function inferFloodZoneFromLayerName(value: unknown): FloodZone | null {
  const record = asRecord(value);
  const features = Array.isArray(record?.features) ? record.features : [];
  for (const feature of features) {
    const props = asRecord(asRecord(feature)?.properties) ?? asRecord(feature);
    if (!props) continue;
    const layer = [
      props.layer,
      props.type,
      props.TYPE,
      props.layer_name,
      props.name,
    ]
      .map(readText)
      .filter(Boolean)
      .join(' ');
    const inferred = normalizeFloodZone(layer);
    if (inferred) return inferred;
  }
  return null;
}

export function parseFloodWarnings(value: unknown): FloodWarningSummary[] {
  const record = asRecord(value);
  const items = Array.isArray(record?.items)
    ? record.items
    : Array.isArray(value)
      ? value
      : [];

  const warnings: FloodWarningSummary[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const id = readText(row['@id'] ?? row.id);
    if (!id) continue;
    const severityLevel =
      typeof row.severityLevel === 'number' &&
      Number.isFinite(row.severityLevel)
        ? row.severityLevel
        : null;
    warnings.push({
      id,
      severity: readText(row.severity),
      severityLevel,
      description: readText(row.description),
      areaName: readText(row.eaAreaName ?? row.floodAreaID),
    });
  }
  return warnings;
}

/**
 * Combine Flood Map for Planning WFS hits (Zone 2 / Zone 3) with optional
 * real-time flood-monitoring warnings. Zone 1 is the residual (no hit).
 */
export function combineFloodLookup(input: {
  zone3?: unknown;
  zone2?: unknown;
  warnings?: unknown;
}): FloodLookupResult {
  const warningList = parseFloodWarnings(input.warnings);
  const inZone3 =
    wfsHasIntersectingFeatures(input.zone3) ||
    inferFloodZoneFromLayerName(input.zone3) === '3';
  const inZone2 =
    wfsHasIntersectingFeatures(input.zone2) ||
    inferFloodZoneFromLayerName(input.zone2) === '2';

  const explicit = normalizeFloodZone(
    asRecord(input.zone3)?.floodZone ?? asRecord(input.zone2)?.floodZone,
  );

  const floodZone: FloodZone =
    explicit && FLOOD_ZONES.includes(explicit)
      ? explicit
      : inZone3
        ? '3'
        : inZone2
          ? '2'
          : '1';

  return {
    floodZone,
    riversAndSea: riversAndSeaFromZone(floodZone),
    surfaceWater: null,
    summary: floodZoneSummary(floodZone, warningList.length),
    activeWarnings: warningList,
    source: 'flood-map-for-planning',
  };
}
