import 'server-only';

import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { z } from 'zod';

import { Mailer, MailerSchema } from '@kit/mailers-shared';

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

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** SES Source must be a bare address; From can still be `Name <email>`. */
export function extractSesSourceAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function buildRawEmail(config: Config) {
  const from = sanitizeHeader(config.from);
  const to = sanitizeHeader(config.to);
  const subject = sanitizeHeader(config.subject);
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (config.replyTo) {
    headers.push(`Reply-To: ${sanitizeHeader(config.replyTo)}`);
  }

  if (config.listUnsubscribeUrl) {
    headers.push(
      `List-Unsubscribe: <${sanitizeHeader(config.listUnsubscribeUrl)}>`,
    );
    headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  }

  if ('text' in config) {
    return [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      config.text,
      '',
    ].join('\r\n');
  }

  return [
    ...headers,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    config.html,
    '',
  ].join('\r\n');
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
 */
class SesMailer implements Mailer {
  async sendEmail(config: Config) {
    const result = await getSesClient().send(
      new SendRawEmailCommand({
        Source: extractSesSourceAddress(config.from),
        Destinations: [config.to],
        RawMessage: {
          Data: Buffer.from(buildRawEmail(config), 'utf8'),
        },
      }),
    );

    return { messageId: result.MessageId ?? null };
  }
}
