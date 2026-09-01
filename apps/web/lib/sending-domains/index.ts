export {
  DEFAULT_SENDING_LOCAL_PARTS,
  SendingDomainError,
  emailDomainOf,
  extractEmailAddress,
  isSendingDomainVerified,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  overallVerificationStatus,
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
