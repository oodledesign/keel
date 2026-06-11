import 'server-only';

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
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

export function createSesMailer() {
  return new SesMailer();
}

/**
 * Sends email via Amazon SES API (not SMTP).
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

    const body =
      'text' in config
        ? { Text: { Data: config.text, Charset: 'UTF-8' } }
        : { Html: { Data: config.html, Charset: 'UTF-8' } };

    await client.send(
      new SendEmailCommand({
        Source: config.from,
        Destination: {
          ToAddresses: [config.to],
        },
        Message: {
          Subject: { Data: config.subject, Charset: 'UTF-8' },
          Body: body,
        },
      }),
    );
  }
}
