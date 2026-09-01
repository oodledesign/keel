import {
  AlreadyExistsException,
  CreateConfigurationSetCommand,
  CreateEmailIdentityCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteEmailIdentityCommand,
  DeleteTenantCommand,
  DeleteTenantResourceAssociationCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

const sesConfigSchema = {
  parse(input: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }) {
    const region = input.region?.trim();
    const accessKeyId = input.accessKeyId?.trim();
    const secretAccessKey = input.secretAccessKey?.trim();

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Amazon SES is not configured. Set AWS_REGION (or SES_REGION), AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.',
      );
    }

    return { region, accessKeyId, secretAccessKey };
  },
};

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

function getSesCredentials() {
  return sesConfigSchema.parse({
    region: process.env.AWS_REGION ?? process.env.SES_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

function isAlreadyExists(error: unknown) {
  return (
    error instanceof AlreadyExistsException ||
    (error instanceof Error &&
      (error.name === 'AlreadyExistsException' ||
        /already exists/i.test(error.message)))
  );
}

function isNotFound(error: unknown) {
  return (
    error instanceof NotFoundException ||
    (error instanceof Error &&
      (error.name === 'NotFoundException' ||
        error.name === 'NotFound' ||
        /not found/i.test(error.message)))
  );
}

function normalizeSesStatus(value: string | undefined | null) {
  return (value ?? 'PENDING').toLowerCase().replace(/-/g, '_');
}

let cachedSesv2: SESv2Client | null = null;
let cachedSts: STSClient | null = null;
let cachedAccountId: string | null = null;

function getSesv2Client() {
  if (!cachedSesv2) {
    const ses = getSesCredentials();
    cachedSesv2 = new SESv2Client({
      region: ses.region,
      credentials: {
        accessKeyId: ses.accessKeyId,
        secretAccessKey: ses.secretAccessKey,
      },
    });
  }
  return cachedSesv2;
}

function getStsClient() {
  if (!cachedSts) {
    const ses = getSesCredentials();
    cachedSts = new STSClient({
      region: ses.region,
      credentials: {
        accessKeyId: ses.accessKeyId,
        secretAccessKey: ses.secretAccessKey,
      },
    });
  }
  return cachedSts;
}

class AwsSesIdentityAdmin implements SesIdentityAdmin {
  getRegion() {
    return getSesCredentials().region;
  }

  async getAccountId() {
    if (process.env.AWS_ACCOUNT_ID?.trim()) {
      return process.env.AWS_ACCOUNT_ID.trim();
    }

    if (cachedAccountId) {
      return cachedAccountId;
    }

    const result = await getStsClient().send(new GetCallerIdentityCommand({}));
    if (!result.Account) {
      throw new Error(
        'Could not resolve AWS account id. Set AWS_ACCOUNT_ID or allow sts:GetCallerIdentity.',
      );
    }

    cachedAccountId = result.Account;
    return cachedAccountId;
  }

  async createDomainIdentity(domain: string) {
    try {
      const result = await getSesv2Client().send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          DkimSigningAttributes: {
            NextSigningKeyLength: 'RSA_2048_BIT',
          },
        }),
      );

      const tokens = result.DkimAttributes?.Tokens ?? [];
      return {
        tokens,
        identityArn: await this.identityArn(domain),
      };
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }

      const existing = await this.getDomainIdentity(domain);
      return {
        tokens: existing.tokens,
        identityArn: existing.identityArn,
      };
    }
  }

  async getDomainIdentity(domain: string): Promise<SesIdentitySnapshot> {
    const result = await getSesv2Client().send(
      new GetEmailIdentityCommand({
        EmailIdentity: domain,
      }),
    );

    return {
      dkimStatus: normalizeSesStatus(result.DkimAttributes?.Status),
      mailFromStatus: result.MailFromAttributes?.MailFromDomainStatus
        ? normalizeSesStatus(result.MailFromAttributes.MailFromDomainStatus)
        : null,
      verifiedForSending: Boolean(result.VerifiedForSendingStatus),
      tokens: result.DkimAttributes?.Tokens ?? [],
      identityArn: await this.identityArn(domain),
    };
  }

  async putMailFrom(domain: string, mailFromDomain: string) {
    await getSesv2Client().send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: domain,
        MailFromDomain: mailFromDomain,
        BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
      }),
    );
  }

  async deleteIdentity(domain: string) {
    try {
      await getSesv2Client().send(
        new DeleteEmailIdentityCommand({
          EmailIdentity: domain,
        }),
      );
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  async ensureConfigurationSet(name: string) {
    try {
      await getSesv2Client().send(
        new CreateConfigurationSetCommand({
          ConfigurationSetName: name,
        }),
      );
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
    }

    return {
      arn: buildSesConfigurationSetArn({
        region: this.getRegion(),
        accountId: await this.getAccountId(),
        name,
      }),
    };
  }

  async ensureTenant(name: string) {
    try {
      await getSesv2Client().send(
        new CreateTenantCommand({
          TenantName: name,
        }),
      );
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
    }
  }

  async associateTenantResource(tenantName: string, resourceArn: string) {
    try {
      await getSesv2Client().send(
        new CreateTenantResourceAssociationCommand({
          TenantName: tenantName,
          ResourceArn: resourceArn,
        }),
      );
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
    }
  }

  async disassociateTenantResource(tenantName: string, resourceArn: string) {
    try {
      await getSesv2Client().send(
        new DeleteTenantResourceAssociationCommand({
          TenantName: tenantName,
          ResourceArn: resourceArn,
        }),
      );
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  async deleteTenant(name: string) {
    try {
      await getSesv2Client().send(
        new DeleteTenantCommand({
          TenantName: name,
        }),
      );
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  private async identityArn(domain: string) {
    return buildSesIdentityArn({
      region: this.getRegion(),
      accountId: await this.getAccountId(),
      domain,
    });
  }
}

export function createSesIdentityAdmin(): SesIdentityAdmin {
  return new AwsSesIdentityAdmin();
}
