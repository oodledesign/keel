import 'server-only';

import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { z } from 'zod';

import { Mailer, MailerSchema } from '@kit/mailers-shared';

import { buildSesRawEmail, extractSesSourceAddress } from './raw-email';

export {
  buildSesRawEmail,
  extractSesSourceAddress,
  sanitizeHeader,
} from './raw-email';
export {
  DEFAULT_SES_CONFIGURATION_SET,
  buildSesConfigurationSetArn,
  buildSesIdentityArn,
  createSesIdentityAdmin,
  sesTenantNameForAccount,
  type SesIdentityAdmin,
  type SesIdentitySnapshot,
} from './identity';

type Config = z.infer<typeof MailerSchema>;

const sesConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

function getSesConfiguration() {
  return sesConfigSchema.parse({
    region: process.env.AWS_REGION ?? process.env.SES_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

let cachedSesClient: SESClient | null = null;

function getSesClient() {
  if (!cachedSesClient) {
    const ses = getSesConfiguration();
    cachedSesClient = new SESClient({
      region: ses.region,
      credentials: {
        accessKeyId: ses.accessKeyId,
        secretAccessKey: ses.secretAccessKey,
      },
    });
  }
  return cachedSesClient;
}

export function createSesMailer() {
  return new SesMailer();
}

/**
 * Sends email via Amazon SES API using SendRawEmail so IAM policies that
 * only grant ses:SendRawEmail (common for SMTP credential users) still work.
 * Custom-domain sends add X-SES-TENANT + X-SES-CONFIGURATION-SET headers.
 */
class SesMailer implements Mailer {
  async sendEmail(config: Config) {
    const result = await getSesClient().send(
      new SendRawEmailCommand({
        Source: extractSesSourceAddress(config.from),
        Destinations: [config.to],
        ConfigurationSetName: config.sesConfigurationSet,
        RawMessage: {
          Data: Buffer.from(buildSesRawEmail(config), 'utf8'),
        },
      }),
    );

    return { messageId: result.MessageId ?? null };
  }
}
