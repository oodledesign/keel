export const FLOOD_RISK_BANDS = ['very_low', 'low', 'medium', 'high'] as const;

export type FloodRiskBand = (typeof FLOOD_RISK_BANDS)[number];

export const FLOOD_RISK_SOURCES = ['placeholder', 'manual', 'gov_uk'] as const;

export type FloodRiskSource = (typeof FLOOD_RISK_SOURCES)[number];

export const EA_LONG_TERM_FLOOD_OGC_BASE_URL =
  'https://environment.data.gov.uk/geoservices/datasets/bb486190-bb9c-4eb0-a4b2-c9bd63ca86ec/ogc/features/v1';

export const EA_FLOOD_MONITORING_BASE_URL =
  'https://environment.data.gov.uk/flood-monitoring';

export const POSTCODES_IO_BASE_URL = 'https://api.postcodes.io';

export const GOV_UK_LONG_TERM_FLOOD_URL =
  'https://www.gov.uk/check-long-term-flood-risk';

/** Present-day defended rivers-and-sea extents (NaFRA / Check your long-term flood risk). */
export const EA_RIVERS_SEA_COLLECTIONS = {
  medium: 'Rivers_1in100_Sea_1in200_defended_extents',
  low: 'Rivers_1in1000_Sea_1in1000_defended_extents',
} as const;

export type FloodCoordinates = {
  latitude: number;
  longitude: number;
  eastings?: number | null;
  northings?: number | null;
  postcode?: string | null;
};

export type FloodLiveWarning = {
  severity: string | null;
  severityLevel: number | null;
  label: string;
  description: string | null;
};

export type FloodLayerHit = {
  collection: string;
  floodSource: string | null;
};

export type FloodAssessment = {
  band: FloodRiskBand;
  summary: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  riversAndSea: {
    mediumExtent: boolean;
    lowExtent: boolean;
    floodSource: string | null;
  };
  liveWarnings: FloodLiveWarning[];
  endpoint: string;
};

export type SurveyFloodRecord = {
  band: FloodRiskBand | null;
  summary: string | null;
  source: FloodRiskSource | null;
  fetchedAt: string | null;
  overridden: boolean;
  pulledBand: FloodRiskBand | null;
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
