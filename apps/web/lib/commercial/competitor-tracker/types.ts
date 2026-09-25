import type {
  CompetitorCategory,
  CompetitorStatus,
  CompetitorTenure,
} from './constants';

export type CompetitorListing = {
  id: string;
  accountId: string;
  name: string;
  locationText: string | null;
  town: string | null;
  postcode: string | null;
  sizeSqft: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  pricePence: number | null;
  tenure: CompetitorTenure | null;
  competitorAgent: string | null;
  category: CompetitorCategory;
  status: CompetitorStatus;
  sourceUrl: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastCheckedAt: string | null;
  priceChangedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorAreaWatch = {
  id: string;
  accountId: string;
  name: string;
  towns: string[];
  postcodePrefixes: string[];
  categories: CompetitorCategory[];
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  notifyOnNew: boolean;
  notifyOnPriceChange: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorWatchNotification = {
  id: string;
  accountId: string;
  watchId: string;
  listingId: string;
  eventType: 'new' | 'price_changed';
  summary: string;
  readAt: string | null;
  createdAt: string;
  listingName?: string | null;
  watchName?: string | null;
};

export type CompetitorUrlEnrichment = {
  name: string | null;
  locationText: string | null;
  postcode: string | null;
  sizeSqft: number | null;
  pricePence: number | null;
  tenure: CompetitorTenure | null;
  competitorAgent: string | null;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
  rawTitle: string | null;
  warnings: string[];
};

export type CreateCompetitorListingInput = {
  accountId: string;
  name: string;
  locationText?: string | null;
  town?: string | null;
  postcode?: string | null;
  sizeSqft?: number | null;
  sizeMinSqft?: number | null;
  sizeMaxSqft?: number | null;
  pricePence?: number | null;
  tenure?: CompetitorTenure | null;
  competitorAgent?: string | null;
  category?: CompetitorCategory;
  status?: CompetitorStatus;
  sourceUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type UpdateCompetitorListingInput = Partial<
  Omit<CreateCompetitorListingInput, 'accountId' | 'createdBy'>
> & {
  listingId: string;
  accountId: string;
};

export type CreateCompetitorWatchInput = {
  accountId: string;
  name: string;
  towns?: string[];
  postcodePrefixes?: string[];
  categories?: CompetitorCategory[];
  sizeMinSqft?: number | null;
  sizeMaxSqft?: number | null;
  notifyOnNew?: boolean;
  notifyOnPriceChange?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
};

export type UpdateCompetitorWatchInput = Partial<
  Omit<CreateCompetitorWatchInput, 'accountId' | 'createdBy'>
> & {
  watchId: string;
  accountId: string;
};

export type CompetitorCsvImportRow = {
  name: string;
  locationText?: string | null;
  town?: string | null;
  postcode?: string | null;
  sizeSqft?: number | null;
  pricePence?: number | null;
  tenure?: CompetitorTenure | null;
  competitorAgent?: string | null;
  category?: CompetitorCategory;
  status?: CompetitorStatus;
  sourceUrl?: string | null;
  notes?: string | null;
};
