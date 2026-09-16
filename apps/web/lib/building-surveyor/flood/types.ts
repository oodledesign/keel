export const EA_FLOOD_MAP_ZONE_3_WFS =
  'https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wfs';

export const EA_FLOOD_MAP_ZONE_2_WFS =
  'https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-2/wfs';

export const EA_FLOOD_MONITORING_FLOODS_URL =
  'https://environment.data.gov.uk/flood-monitoring/id/floods';

export const FLOOD_ZONES = ['1', '2', '3'] as const;

export type FloodZone = (typeof FLOOD_ZONES)[number];

export const OVERRIDABLE_FLOOD_FIELDS = [
  'floodZone',
  'riversAndSea',
  'surfaceWater',
  'summary',
] as const;

export type OverridableFloodField = (typeof OVERRIDABLE_FLOOD_FIELDS)[number];

export type FloodFieldSnapshot = {
  floodZone: FloodZone | null;
  riversAndSea: string | null;
  surfaceWater: string | null;
  summary: string | null;
};

export type FloodWarningSummary = {
  id: string;
  severity: string | null;
  severityLevel: number | null;
  description: string | null;
  areaName: string | null;
};

export type FloodLookupResult = {
  floodZone: FloodZone;
  riversAndSea: string | null;
  surfaceWater: string | null;
  summary: string;
  activeWarnings: FloodWarningSummary[];
  source: 'flood-map-for-planning';
};

export type SurveyFloodRecord = {
  id: string;
  proposalId: string;
  floodZone: FloodZone | null;
  riversAndSea: string | null;
  surfaceWater: string | null;
  summary: string | null;
  activeWarningCount: number;
  pulled: FloodFieldSnapshot;
  overriddenFields: OverridableFloodField[];
  fetchedAt: string;
};

export class FloodApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FloodApiError';
    this.status = status;
  }
}
