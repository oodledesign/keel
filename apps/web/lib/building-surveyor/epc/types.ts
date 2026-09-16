export const GOV_UK_EPC_API_BASE_URL =
  'https://api.get-energy-performance-data.communities.gov.uk';

export const EPC_CERTIFICATE_NUMBER_RE =
  /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$/;

export const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export type EpcEnergyBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type EpcSearchHit = {
  certificateNumber: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postTown: string | null;
  postcode: string | null;
  uprn: string | null;
  currentEnergyEfficiencyBand: string | null;
  registrationDate: string | null;
  schemaType: string | null;
  council: string | null;
};

export type EpcRecommendation = {
  sequence: number | null;
  description: string;
  typicalSaving: string | null;
  indicativeCost: string | null;
};

export type EpcCertificateSummary = {
  certificateNumber: string;
  uprn: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postTown: string | null;
  postcode: string | null;
  currentRating: string | null;
  potentialRating: string | null;
  currentScore: number | null;
  potentialScore: number | null;
  lodgementDate: string | null;
  floorArea: number | null;
  fuelType: string | null;
  dwellingType: string | null;
  recommendations: EpcRecommendation[];
  recommendationsSummary: string | null;
};

export type SurveyEpcRecord = {
  id: string;
  proposalId: string;
  certificateNumber: string;
  uprn: string | null;
  currentRating: string | null;
  potentialRating: string | null;
  lodgementDate: string | null;
  floorArea: number | null;
  fuelType: string | null;
  recommendationsSummary: string | null;
  fetchedAt: string;
};

export type SurveyPropertyLookup = {
  address: string | null;
  postcode: string | null;
  uprn: string | null;
};

export type EpcApiErrorCode = 400 | 401 | 403 | 404 | 429 | 500;

export class EpcApiError extends Error {
  readonly status: EpcApiErrorCode;

  constructor(status: EpcApiErrorCode, message: string) {
    super(message);
    this.name = 'EpcApiError';
    this.status = status;
  }
}
