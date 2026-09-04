export const DEFAULT_SES_CONFIGURATION_SET = 'ozer-custom-domains';

export function sesTenantNameForAccount(accountId: string) {
  return `ozer-account-${accountId}`;
}

export function buildSesIdentityArn(input: {
  region: string;
  accountId: string;
  domain: string;
}) {
  return `arn:aws:ses:${input.region}:${input.accountId}:identity/${input.domain}`;
}

export function buildSesConfigurationSetArn(input: {
  region: string;
  accountId: string;
  name: string;
}) {
  return `arn:aws:ses:${input.region}:${input.accountId}:configuration-set/${input.name}`;
}

export type SesIdentitySnapshot = {
  dkimStatus: string;
  mailFromStatus: string | null;
  verifiedForSending: boolean;
  tokens: string[];
  identityArn: string;
};

export interface SesIdentityAdmin {
  getRegion(): string;
  getAccountId(): Promise<string>;
  createDomainIdentity(
    domain: string,
  ): Promise<{ tokens: string[]; identityArn: string }>;
  getDomainIdentity(domain: string): Promise<SesIdentitySnapshot>;
  putMailFrom(domain: string, mailFromDomain: string): Promise<void>;
  deleteIdentity(domain: string): Promise<void>;
  ensureConfigurationSet(name: string): Promise<{ arn: string }>;
  ensureTenant(name: string): Promise<void>;
  associateTenantResource(
    tenantName: string,
    resourceArn: string,
  ): Promise<void>;
  disassociateTenantResource(
    tenantName: string,
    resourceArn: string,
  ): Promise<void>;
  deleteTenant(name: string): Promise<void>;
}

export {
  SES_IDENTITY_ADMIN_IAM_ACTIONS,
  isSesAccessDeniedError,
  mapSesIdentityAdminError,
  sesAccessDeniedUserMessage,
} from './identity-errors';
