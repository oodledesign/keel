import {
  AlreadyExistsException,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateEmailIdentityCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteEmailIdentityCommand,
  DeleteTenantCommand,
  DeleteTenantResourceAssociationCommand,
  GetConfigurationSetEventDestinationsCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  PutConfigurationSetTrackingOptionsCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

import {
  type SesIdentityAdmin,
  type SesIdentitySnapshot,
  buildSesConfigurationSetArn,
  buildSesIdentityArn,
} from './identity-shared';

/**
 * IAM actions required for custom sending domains are documented in
 * packages/mailers/ses/IAM.md and listed by SES_IDENTITY_ADMIN_IAM_ACTIONS.
 */
export {
  DEFAULT_SES_CONFIGURATION_SET,
  SES_IDENTITY_ADMIN_IAM_ACTIONS,
  buildSesConfigurationSetArn,
  buildSesIdentityArn,
  isSesAccessDeniedError,
  mapSesIdentityAdminError,
  sesAccessDeniedUserMessage,
  sesTenantNameForAccount,
  type SesIdentityAdmin,
  type SesIdentitySnapshot,
} from './identity-shared';

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

    await this.ensureConfigurationSetEventWiring(name);

    return {
      arn: buildSesConfigurationSetArn({
        region: this.getRegion(),
        accountId: await this.getAccountId(),
        name,
      }),
    };
  }

  /**
   * When SES_EVENTS_SNS_TOPIC_ARN is set, attach (or reuse) an SNS event
   * destination for delivery/bounce/complaint/open/click. Soft-fails on
   * AccessDenied so domain creation still succeeds.
   *
   * Open/click also need SES tracking on the configuration set; optional
   * SES_TRACKING_DOMAIN (HTTPS custom redirect domain) is applied when set.
   */
  private async ensureConfigurationSetEventWiring(name: string) {
    const topicArn = process.env.SES_EVENTS_SNS_TOPIC_ARN?.trim();
    if (topicArn) {
      try {
        await this.ensureSnsEventDestination(name, topicArn);
      } catch (error) {
        console.warn(
          '[ses] ensure SNS event destination failed; continuing',
          error instanceof Error ? error.message : error,
        );
      }
    }

    const trackingDomain = process.env.SES_TRACKING_DOMAIN?.trim();
    if (trackingDomain) {
      try {
        await getSesv2Client().send(
          new PutConfigurationSetTrackingOptionsCommand({
            ConfigurationSetName: name,
            TrackingOptions: {
              CustomRedirectDomain: trackingDomain,
            },
          }),
        );
      } catch (error) {
        console.warn(
          '[ses] PutConfigurationSetTrackingOptions failed; continuing',
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  private async ensureSnsEventDestination(name: string, topicArn: string) {
    const destinationName = 'ozer-sns-events';
    const matchingEventTypes = [
      'SEND',
      'REJECT',
      'BOUNCE',
      'COMPLAINT',
      'DELIVERY',
      'OPEN',
      'CLICK',
      'RENDERING_FAILURE',
      'DELIVERY_DELAY',
    ] as const;

    try {
      const existing = await getSesv2Client().send(
        new GetConfigurationSetEventDestinationsCommand({
          ConfigurationSetName: name,
        }),
      );

      const already = (existing.EventDestinations ?? []).some(
        (dest: { Name?: string; SnsDestination?: { TopicArn?: string } }) =>
          dest.Name === destinationName ||
          dest.SnsDestination?.TopicArn === topicArn,
      );
      if (already) {
        return;
      }
    } catch (error) {
      if (!isNotFound(error)) {
        // Fall through to create; Get may be denied while Create works
        console.warn(
          '[ses] GetConfigurationSetEventDestinations failed; attempting create',
          error instanceof Error ? error.message : error,
        );
      }
    }

    try {
      await getSesv2Client().send(
        new CreateConfigurationSetEventDestinationCommand({
          ConfigurationSetName: name,
          EventDestinationName: destinationName,
          EventDestination: {
            Enabled: true,
            MatchingEventTypes: [...matchingEventTypes],
            SnsDestination: {
              TopicArn: topicArn,
            },
          },
        }),
      );
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
    }
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
