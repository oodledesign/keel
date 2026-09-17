import {
  EA_FLOOD_ZONES_ATTRIBUTION,
  EA_FLOOD_ZONES_DISCLAIMER,
  ENGLAND_COUNTRY,
  FLOOD_PLANNING_ZONES,
  FLOOD_PLANNING_ZONE_OPTIONS,
  FLOOD_RISK_BANDS,
  FLOOD_RISK_SOURCES,
  type FloodAssessment,
  type FloodCoverage,
  type FloodLiveWarning,
  type FloodPlanningZone,
  type FloodRiskBand,
  type FloodRiskSource,
  type FloodZoneHit,
  type SurveyFloodRecord,
} from './types';

const BBOX_PAD_DEGREES = 0.0004;

export function floodBbox(longitude: number, latitude: number): string {
  const round = (value: number) => Number(value.toFixed(6));
  return [
    round(longitude - BBOX_PAD_DEGREES),
    round(latitude - BBOX_PAD_DEGREES),
    round(longitude + BBOX_PAD_DEGREES),
    round(latitude + BBOX_PAD_DEGREES),
  ].join(',');
}

export function isFloodRiskBand(
  value: string | null | undefined,
): value is FloodRiskBand {
  return Boolean(value && FLOOD_RISK_BANDS.includes(value as FloodRiskBand));
}

export function isFloodPlanningZone(
  value: string | null | undefined,
): value is FloodPlanningZone {
  return Boolean(
    value && FLOOD_PLANNING_ZONES.includes(value as FloodPlanningZone),
  );
}

export function isFloodRiskSource(
  value: string | null | undefined,
): value is FloodRiskSource {
  return Boolean(
    value && FLOOD_RISK_SOURCES.includes(value as FloodRiskSource),
  );
}

export function isFloodCoverage(
  value: string | null | undefined,
): value is FloodCoverage {
  return value === 'england' || value === 'not_england' || value === 'unknown';
}

export function normalizeCountryName(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isEnglandCountry(country: string | null | undefined): boolean {
  return (
    normalizeCountryName(country)?.toLowerCase() ===
    ENGLAND_COUNTRY.toLowerCase()
  );
}

export function isNonEnglandUkCountry(
  country: string | null | undefined,
): boolean {
  const normalized = normalizeCountryName(country)?.toLowerCase();
  return (
    normalized === 'wales' ||
    normalized === 'scotland' ||
    normalized === 'northern ireland'
  );
}

export function planningZoneToBand(
  zone: FloodPlanningZone | null | undefined,
): FloodRiskBand | null {
  const match = FLOOD_PLANNING_ZONE_OPTIONS.find(
    (option) => option.zone === zone,
  );
  return match?.band ?? null;
}

export function bandToPlanningZone(
  band: FloodRiskBand | null | undefined,
): FloodPlanningZone | null {
  if (band === 'low') return 'zone_1';
  const match = FLOOD_PLANNING_ZONE_OPTIONS.find(
    (option) => option.band === band,
  );
  return match?.zone ?? null;
}

export function floodPlanningZoneLabel(
  zone: FloodPlanningZone | null | undefined,
) {
  switch (zone) {
    case 'zone_3':
      return 'Zone 3';
    case 'zone_2':
      return 'Zone 2';
    case 'zone_1':
      return 'Zone 1';
    default:
      return 'Not assessed';
  }
}

export function floodRiskBandLabel(band: FloodRiskBand | null | undefined) {
  const zone = bandToPlanningZone(band);
  if (zone && band !== 'low') return floodPlanningZoneLabel(zone);
  if (band === 'low') return 'Low (legacy)';
  return 'Not assessed';
}

export function parseFloodZoneCode(value: unknown): FloodPlanningZone | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseFloodZoneCode(String(value));
  }
  if (typeof value !== 'string') return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
  if (!normalized) return null;
  if (
    normalized === 'FZ3' ||
    normalized === 'FLOODZONE3' ||
    normalized === 'ZONE3' ||
    normalized === '3'
  ) {
    return 'zone_3';
  }
  if (
    normalized === 'FZ2' ||
    normalized === 'FLOODZONE2' ||
    normalized === 'ZONE2' ||
    normalized === '2'
  ) {
    return 'zone_2';
  }
  if (
    normalized === 'FZ1' ||
    normalized === 'FLOODZONE1' ||
    normalized === 'ZONE1' ||
    normalized === '1'
  ) {
    return 'zone_1';
  }
  return null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseOgcFloodZoneFeatures(payload: unknown): {
  hits: FloodZoneHit[];
  highestZone: FloodPlanningZone | null;
} {
  if (!payload || typeof payload !== 'object') {
    return { hits: [], highestZone: null };
  }

  const features = Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];

  const hits: FloodZoneHit[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const properties =
      'properties' in feature &&
      feature.properties &&
      typeof feature.properties === 'object'
        ? (feature.properties as Record<string, unknown>)
        : null;
    const zone = parseFloodZoneCode(properties?.flood_zone);
    if (!zone || zone === 'zone_1') continue;
    hits.push({
      zone,
      floodSource: asOptionalString(properties?.flood_source),
      origin: asOptionalString(properties?.origin),
    });
  }

  const highestZone = hits.some((hit) => hit.zone === 'zone_3')
    ? 'zone_3'
    : hits.some((hit) => hit.zone === 'zone_2')
      ? 'zone_2'
      : null;

  return { hits, highestZone };
}

export function resolvePlanningZone(input: {
  highestIntersectedZone: FloodPlanningZone | null;
  country?: string | null;
}): {
  planningZone: FloodPlanningZone | null;
  coverage: FloodCoverage;
} {
  if (isNonEnglandUkCountry(input.country)) {
    return { planningZone: null, coverage: 'not_england' };
  }

  if (input.highestIntersectedZone) {
    return {
      planningZone: input.highestIntersectedZone,
      coverage: 'england',
    };
  }

  if (isEnglandCountry(input.country)) {
    return { planningZone: 'zone_1', coverage: 'england' };
  }

  return { planningZone: null, coverage: 'unknown' };
}

export function parseFloodMonitoringWarnings(
  payload: unknown,
): FloodLiveWarning[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  return items
    .map((item): FloodLiveWarning | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as {
        severity?: unknown;
        severityLevel?: unknown;
        description?: unknown;
        message?: unknown;
        floodArea?: { label?: unknown; riverOrSea?: unknown };
        eaAreaName?: unknown;
      };
      const label =
        (typeof row.description === 'string' && row.description.trim()) ||
        (typeof row.floodArea?.label === 'string' &&
          row.floodArea.label.trim()) ||
        (typeof row.eaAreaName === 'string' && row.eaAreaName.trim()) ||
        'Flood warning';
      const severity =
        typeof row.severity === 'string' ? row.severity.trim() : null;
      const severityLevel =
        typeof row.severityLevel === 'number' ? row.severityLevel : null;
      const description =
        typeof row.message === 'string' ? row.message.trim() : null;
      return { severity, severityLevel, label, description };
    })
    .filter((item): item is FloodLiveWarning => item != null)
    .slice(0, 6);
}

export function summarisePlanningFloodAssessment(input: {
  planningZone: FloodPlanningZone | null;
  coverage: FloodCoverage;
  country: string | null;
  floodSource: string | null;
  liveWarnings: FloodLiveWarning[];
}): string {
  const source =
    input.floodSource === 'sea'
      ? 'the sea'
      : input.floodSource === 'river'
        ? 'rivers'
        : input.floodSource === 'river and sea'
          ? 'rivers and the sea'
          : 'rivers or the sea';

  let summary: string;
  if (input.coverage === 'not_england') {
    summary = `Flood Map for Planning zones are published for England only. This address is in ${input.country ?? 'a nation outside England'}, so no English flood zone has been assigned.`;
  } else if (input.planningZone === 'zone_3') {
    summary = `Flood Map for Planning Zone 3 (England) — land with a high probability of flooding from ${source}. ${EA_FLOOD_ZONES_DISCLAIMER}`;
  } else if (input.planningZone === 'zone_2') {
    summary = `Flood Map for Planning Zone 2 (England) — land with a medium probability of flooding from ${source}. ${EA_FLOOD_ZONES_DISCLAIMER}`;
  } else if (input.planningZone === 'zone_1') {
    summary = `Flood Map for Planning Zone 1 (England) — this point sits outside published Flood Zone 2 and 3 extents, so it is treated as Zone 1 (low probability of flooding from rivers or the sea). ${EA_FLOOD_ZONES_DISCLAIMER}`;
  } else {
    summary = `No Flood Zone 2 or 3 polygon intersects this point, but the address could not be confirmed as England, so Zone 1 has not been assumed.`;
  }

  if (input.liveWarnings.length > 0) {
    const names = input.liveWarnings
      .map((warning) => warning.label)
      .filter(Boolean)
      .slice(0, 2)
      .join('; ');
    summary += ` Current Environment Agency warning nearby: ${names}. This is a live alert, not the planning zone.`;
  }

  return summary;
}

export function buildFloodAssessment(input: {
  latitude: number;
  longitude: number;
  postcode?: string | null;
  country?: string | null;
  zoneHits: FloodZoneHit[];
  highestIntersectedZone: FloodPlanningZone | null;
  liveWarnings: FloodLiveWarning[];
  endpoint: string;
}): FloodAssessment {
  const country = normalizeCountryName(input.country);
  const resolved = resolvePlanningZone({
    highestIntersectedZone: input.highestIntersectedZone,
    country,
  });
  const floodSource =
    input.zoneHits.find((hit) => hit.zone === resolved.planningZone)
      ?.floodSource ??
    input.zoneHits[0]?.floodSource ??
    null;

  return {
    band: planningZoneToBand(resolved.planningZone),
    planningZone: resolved.planningZone,
    coverage: resolved.coverage,
    country,
    summary: summarisePlanningFloodAssessment({
      planningZone: resolved.planningZone,
      coverage: resolved.coverage,
      country,
      floodSource,
      liveWarnings: input.liveWarnings,
    }),
    latitude: input.latitude,
    longitude: input.longitude,
    postcode: input.postcode ?? null,
    floodSource,
    zoneHits: input.zoneHits,
    liveWarnings: input.liveWarnings,
    endpoint: input.endpoint,
    attribution: EA_FLOOD_ZONES_ATTRIBUTION,
    disclaimer: EA_FLOOD_ZONES_DISCLAIMER,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function mapSurveyFloodRow(row: {
  survey_flood_risk_band?: string | null;
  survey_flood_risk_summary?: string | null;
  survey_flood_source?: string | null;
  survey_flood_raw_json?: unknown;
  survey_flood_fetched_at?: string | null;
}): SurveyFloodRecord {
  const raw = asRecord(row.survey_flood_raw_json);
  const pulled = asRecord(raw?.pulled);
  const pulledBandValue = typeof pulled?.band === 'string' ? pulled.band : null;
  const pulledBand = isFloodRiskBand(pulledBandValue) ? pulledBandValue : null;
  const planningZoneValue =
    typeof pulled?.planningZone === 'string' ? pulled.planningZone : null;
  const planningZone = isFloodPlanningZone(planningZoneValue)
    ? planningZoneValue
    : bandToPlanningZone(pulledBand);
  const coverageValue =
    typeof pulled?.coverage === 'string' ? pulled.coverage : null;
  const coverage = isFloodCoverage(coverageValue) ? coverageValue : null;
  const country =
    typeof pulled?.country === 'string' ? pulled.country.trim() || null : null;
  const source = isFloodRiskSource(row.survey_flood_source)
    ? row.survey_flood_source
    : null;

  return {
    band: isFloodRiskBand(row.survey_flood_risk_band)
      ? row.survey_flood_risk_band
      : null,
    summary: row.survey_flood_risk_summary?.trim() || null,
    source,
    fetchedAt: row.survey_flood_fetched_at ?? null,
    overridden: source === 'manual',
    pulledBand,
    planningZone,
    coverage,
    country,
    raw,
  };
}
