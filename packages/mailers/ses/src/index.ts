import 'server-only';

import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses';
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

function buildRawEmail(config: Config) {
  const from = sanitizeHeader(config.from);
  const to = sanitizeHeader(config.to);
  const subject = sanitizeHeader(config.subject);

  if ('text' in config) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      config.text,
      '',
    ].join('\r\n');
  }

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    config.html,
    '',
  ].join('\r\n');
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
    const ses = getSesConfiguration();
    const client = new SESClient({
      region: ses.region,
      credentials: {
        accessKeyId: ses.accessKeyId,
        secretAccessKey: ses.secretAccessKey,
      },
    });

    await client.send(
      new SendRawEmailCommand({
        Source: config.from,
        Destinations: [config.to],
        RawMessage: {
          Data: Buffer.from(buildRawEmail(config), 'utf8'),
        },
      }),
    );
  }
}
