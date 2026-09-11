export const DYNAMICS_ENTITIES = ['contact', 'lead'] as const;
export type DynamicsEntity = (typeof DYNAMICS_ENTITIES)[number];

export const DYNAMICS_COMPANY_STRATEGIES = [
  'account_lookup',
  'contact_field',
  'none',
] as const;
export type DynamicsCompanyStrategy =
  (typeof DYNAMICS_COMPANY_STRATEGIES)[number];

export const DYNAMICS_CONSENT_MODES = [
  'donotemail_inverted',
  'boolean_opt_in',
] as const;
export type DynamicsConsentMode = (typeof DYNAMICS_CONSENT_MODES)[number];

export const DYNAMICS_SYNC_JOB_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
] as const;
export type DynamicsSyncJobStatus = (typeof DYNAMICS_SYNC_JOB_STATUSES)[number];

/** Dataverse logical names: letter, then letters/digits/underscore. */
export const DATAVERSE_LOGICAL_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export type DynamicsFieldMapping = {
  email: string;
  firstName: string;
  lastName: string;
  /** Contact text field or Lead `companyname`. Unused when strategy is account_lookup. */
  company: string | null;
  companyStrategy: DynamicsCompanyStrategy;
  consentMode: DynamicsConsentMode;
  /** Standard Sales flags, typically `donotemail` + `donotbulkemail`. */
  consentFields: string[];
  /** Optional custom boolean, e.g. `new_marketingconsent`. */
  extraConsentField: string | null;
};

export type DynamicsSubscriber = {
  email: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  marketingOptedIn: boolean;
};

export type DynamicsConnectionPublic = {
  connected: boolean;
  syncEnabled: boolean;
  tenantId: string;
  environmentUrl: string;
  applicationId: string;
  hasClientSecret: boolean;
  entity: DynamicsEntity;
  fieldMapping: DynamicsFieldMapping;
  lastTestedAt: string | null;
  lastTestError: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  pendingJobCount: number;
  failedJobCount: number;
  canEncryptSecrets: boolean;
};

export type DynamicsConnectionSecrets = {
  tenantId: string;
  environmentUrl: string;
  applicationId: string;
  clientSecret: string;
  entity: DynamicsEntity;
  fieldMapping: DynamicsFieldMapping;
  syncEnabled: boolean;
};

export type DynamicsSyncJobPayload = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  marketingOptedIn: boolean;
};

export type DynamicsSyncJob = {
  id: string;
  accountId: string;
  preferenceId: string | null;
  clientId: string | null;
  email: string;
  payload: DynamicsSyncJobPayload;
  status: DynamicsSyncJobStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  dynamicsRecordId: string | null;
  createdAt: string;
};

export type DataverseWhoAmI = {
  UserId: string;
  BusinessUnitId: string;
  OrganizationId: string;
};
