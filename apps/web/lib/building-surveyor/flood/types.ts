export const FLOOD_RISK_BANDS = ['very_low', 'low', 'medium', 'high'] as const;

export type FloodRiskBand = (typeof FLOOD_RISK_BANDS)[number];

/** Flood Map for Planning zones stored via the existing band column. */
export const FLOOD_PLANNING_ZONES = ['zone_1', 'zone_2', 'zone_3'] as const;

export type FloodPlanningZone = (typeof FLOOD_PLANNING_ZONES)[number];

export const FLOOD_PLANNING_ZONE_OPTIONS = [
  { zone: 'zone_1', band: 'very_low', label: 'Zone 1' },
  { zone: 'zone_2', band: 'medium', label: 'Zone 2' },
  { zone: 'zone_3', band: 'high', label: 'Zone 3' },
] as const satisfies ReadonlyArray<{
  zone: FloodPlanningZone;
  band: FloodRiskBand;
  label: string;
}>;

export type FloodCoverage = 'england' | 'not_england' | 'unknown';

export const FLOOD_RISK_SOURCES = ['placeholder', 'manual', 'gov_uk'] as const;

export type FloodRiskSource = (typeof FLOOD_RISK_SOURCES)[number];

/** Environment Agency Flood Map for Planning – Flood Zones (England, OGL, no key). */
export const EA_FLOOD_ZONES_DATASET_ID = '04532375-a198-476e-985e-0579a0a11b47';

export const EA_FLOOD_ZONES_OGC_BASE_URL = `https://environment.data.gov.uk/geoservices/datasets/${EA_FLOOD_ZONES_DATASET_ID}/ogc/features/v1`;

export const EA_FLOOD_ZONES_COLLECTION = 'Flood_Zones_2_3_Rivers_and_Sea';

export const EA_FLOOD_ZONES_DATASET_URL = `https://environment.data.gov.uk/dataset/${EA_FLOOD_ZONES_DATASET_ID}`;

export const EA_FLOOD_MONITORING_BASE_URL =
  'https://environment.data.gov.uk/flood-monitoring';

export const POSTCODES_IO_BASE_URL = 'https://api.postcodes.io';

export const GOV_UK_FLOOD_MAP_FOR_PLANNING_URL =
  'https://flood-map-for-planning.service.gov.uk/';

export const OPEN_GOVERNMENT_LICENCE_URL =
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';

export const EA_FLOOD_ZONES_ATTRIBUTION =
  'Contains Environment Agency information © Environment Agency and/or database right. Contains public sector information licensed under the Open Government Licence v3.0.';

export const EA_FLOOD_ZONES_DISCLAIMER =
  'Flood Map for Planning zones are an area indication for England, not a property-specific flood risk assessment.';

export const EA_SURFACE_WATER_NOTE =
  'Surface water (rainfall) flood risk is a separate Environment Agency dataset and is not included here.';

export type FloodCoordinates = {
  latitude: number;
  longitude: number;
  eastings?: number | null;
  northings?: number | null;
  postcode?: string | null;
  country?: string | null;
};

export type FloodLiveWarning = {
  severity: string | null;
  severityLevel: number | null;
  label: string;
  description: string | null;
};

export type FloodZoneHit = {
  zone: FloodPlanningZone;
  floodSource: string | null;
  origin: string | null;
};

export type FloodAssessment = {
  band: FloodRiskBand | null;
  planningZone: FloodPlanningZone | null;
  coverage: FloodCoverage;
  country: string | null;
  summary: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  floodSource: string | null;
  zoneHits: FloodZoneHit[];
  liveWarnings: FloodLiveWarning[];
  endpoint: string;
  attribution: string;
  disclaimer: string;
};

export type SurveyFloodRecord = {
  band: FloodRiskBand | null;
  summary: string | null;
  source: FloodRiskSource | null;
  fetchedAt: string | null;
  overridden: boolean;
  pulledBand: FloodRiskBand | null;
  planningZone: FloodPlanningZone | null;
  coverage: FloodCoverage | null;
  country: string | null;
  raw: Record<string, unknown> | null;
};

export class FloodApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FloodApiError';
    this.status = status;
  }
}
