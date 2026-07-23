export type GscConnectionStatus = {
  connected: boolean;
  googleEmail: string | null;
  propertyUri: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  configured: boolean;
};

export type GscSite = {
  siteUrl: string;
  permissionLevel: string | null;
};

export type GscQueryMetricRow = {
  query: string;
  queryNormalized: string;
  metricDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscKeywordSupplement = {
  queryNormalized: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
};

export type GscTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type GscConnectionRow = {
  id: string;
  project_id: string;
  account_id: string;
  google_email: string | null;
  property_uri: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  connected_by: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  sync_from_date: string | null;
};
