export {
  DEFAULT_MAIL_FROM_SUBDOMAIN,
  DEFAULT_SENDING_LOCAL_PART,
  DEFAULT_SENDING_LOCAL_PARTS,
  DEFAULT_SENDING_SUBDOMAIN,
  DEFAULT_SENDING_SUBDOMAIN_SUGGESTIONS,
  SendingDomainError,
  dnsHostRelativeToApex,
  emailDomainOf,
  extractEmailAddress,
  formatSendingFromAddress,
  isSendingDomainVerified,
  isSesStatusFailed,
  isSesStatusSuccess,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  normalizeSendingSubdomain,
  overallVerificationStatus,
  dnsRecordPurposeLabel,
  recordVerificationStatus,
  resolveMailFromHost,
  resolveSendingHost,
  type DnsRecordPurpose,
  type DnsRecordVerificationStatus,
} from './domain';
export { buildSendingDnsRecords, type SendingDnsRecord } from './dns-records';
export {
  getPlatformSesFrom,
  resolveWorkspaceMailFrom,
  type SendingDomainFromInput,
} from './resolve-from';
export {
  createSendingDomainService,
  loadAccountSendingDomain,
} from './sending-domain.service';
export {
  ACCOUNT_SENDING_DOMAINS_TABLE,
  type ResolvedWorkspaceMailFrom,
  type SendingDomainRecord,
} from './types';
