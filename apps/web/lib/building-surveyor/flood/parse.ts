import {
  FLOOD_RISK_BANDS,
  FLOOD_RISK_SOURCES,
  type FloodAssessment,
  type FloodLayerHit,
  type FloodLiveWarning,
  type FloodRiskBand,
  type FloodRiskSource,
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

export function isFloodRiskSource(
  value: string | null | undefined,
): value is FloodRiskSource {
  return Boolean(
    value && FLOOD_RISK_SOURCES.includes(value as FloodRiskSource),
  );
}

export function floodRiskBandLabel(band: FloodRiskBand | null | undefined) {
  switch (band) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    case 'very_low':
      return 'Very low';
    default:
      return 'Not assessed';
  }
}

export function classifyRiversAndSeaBand(input: {
  mediumExtent: boolean;
  lowExtent: boolean;
}): FloodRiskBand {
  if (input.mediumExtent) return 'medium';
  if (input.lowExtent) return 'low';
  return 'very_low';
}

export function parseOgcFeatureCount(payload: unknown): {
  hit: boolean;
  floodSource: string | null;
} {
  if (!payload || typeof payload !== 'object') {
    return { hit: false, floodSource: null };
  }
  const record = payload as {
    features?: unknown;
    numberReturned?: unknown;
    numberMatched?: unknown;
  };
  const features = Array.isArray(record.features) ? record.features : [];
  const first = features[0];
  const properties =
    first && typeof first === 'object' && 'properties' in first
      ? (first as { properties?: { flood_source?: unknown } }).properties
      : null;
  const floodSource =
    typeof properties?.flood_source === 'string'
      ? properties.flood_source.trim() || null
      : null;
  const matched =
    typeof record.numberMatched === 'number'
      ? record.numberMatched
      : typeof record.numberReturned === 'number'
        ? record.numberReturned
        : features.length;
  return { hit: matched > 0 || features.length > 0, floodSource };
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

export function summariseFloodAssessment(input: {
  band: FloodRiskBand;
  floodSource: string | null;
  liveWarnings: FloodLiveWarning[];
}): string {
  const source =
    input.floodSource === 'sea'
      ? 'the sea'
      : input.floodSource === 'river'
        ? 'rivers'
        : 'rivers and the sea';

  let summary: string;
  switch (input.band) {
    case 'high':
      summary = `High long-term flood risk from ${source} (present-day defended extents).`;
      break;
    case 'medium':
      summary = `Medium long-term flood risk from ${source} — the property sits in the present-day 1-in-100 rivers / 1-in-200 sea defended extent.`;
      break;
    case 'low':
      summary = `Low long-term flood risk from ${source} — the property sits in the present-day 1-in-1,000 defended extent but not the 1-in-100 rivers / 1-in-200 sea extent.`;
      break;
    default:
      summary =
        'Very low long-term flood risk from rivers and the sea at this point — it is outside the published present-day defended 1-in-1,000 extent.';
  }

  if (input.liveWarnings.length > 0) {
    const names = input.liveWarnings
      .map((warning) => warning.label)
      .filter(Boolean)
      .slice(0, 2)
      .join('; ');
    summary += ` Current Environment Agency warning nearby: ${names}. This is a live alert, not the long-term band.`;
  }

  return summary;
}

export function buildFloodAssessment(input: {
  latitude: number;
  longitude: number;
  postcode?: string | null;
  layers: FloodLayerHit[];
  liveWarnings: FloodLiveWarning[];
  endpoint: string;
}): FloodAssessment {
  const medium = input.layers.find((layer) =>
    layer.collection.includes('1in100'),
  );
  const low = input.layers.find((layer) =>
    layer.collection.includes('1in1000'),
  );
  const mediumExtent = Boolean(medium);
  const lowExtent = Boolean(low);
  const band = classifyRiversAndSeaBand({ mediumExtent, lowExtent });
  const floodSource = medium?.floodSource ?? low?.floodSource ?? null;

  return {
    band,
    summary: summariseFloodAssessment({
      band,
      floodSource,
      liveWarnings: input.liveWarnings,
    }),
    latitude: input.latitude,
    longitude: input.longitude,
    postcode: input.postcode ?? null,
    riversAndSea: {
      mediumExtent,
      lowExtent,
      floodSource,
    },
    liveWarnings: input.liveWarnings,
    endpoint: input.endpoint,
  };
}

export function mapSurveyFloodRow(row: {
  survey_flood_risk_band?: string | null;
  survey_flood_risk_summary?: string | null;
  survey_flood_source?: string | null;
  survey_flood_raw_json?: unknown;
  survey_flood_fetched_at?: string | null;
}): SurveyFloodRecord {
  const raw =
    row.survey_flood_raw_json &&
    typeof row.survey_flood_raw_json === 'object' &&
    !Array.isArray(row.survey_flood_raw_json)
      ? (row.survey_flood_raw_json as Record<string, unknown>)
      : null;
  const pulled = raw?.pulled;
  const pulledBand =
    pulled && typeof pulled === 'object' && 'band' in pulled
      ? isFloodRiskBand(String((pulled as { band?: unknown }).band))
        ? ((pulled as { band: FloodRiskBand }).band ?? null)
        : null
      : null;
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
    raw,
  };
}
