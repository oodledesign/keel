import type { SendingDnsRecord } from './dns-records';

export type SendingDomainRecord = {
  id: string;
  account_id: string;
  domain: string;
  sending_subdomain: string | null;
  sending_host: string;
  mail_from_subdomain: string;
  default_local_part: string;
  ses_identity_name: string | null;
  ses_identity_arn: string | null;
  ses_tenant_name: string | null;
  ses_configuration_set: string | null;
  dkim_tokens: string[];
  dns_records: SendingDnsRecord[];
  dkim_status: string;
  mail_from_status: string;
  verification_status: 'pending' | 'verified' | 'failed';
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedWorkspaceMailFrom = {
  fromEmail: string | null;
  fromName: string;
  fromHeader: string | null;
  replyTo: string | null;
  source: 'custom_domain' | 'existing' | 'platform';
  sesTenantName: string | null;
  sesConfigurationSet: string | null;
  verifiedCustomDomain: boolean;
};

export const ACCOUNT_SENDING_DOMAINS_TABLE = 'account_sending_domains';
