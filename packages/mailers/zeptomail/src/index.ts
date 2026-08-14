import 'server-only';

import { z } from 'zod';
import { SendMailClient } from 'zeptomail';

import { Mailer, MailerSchema } from '@kit/mailers-shared';

type Config = z.infer<typeof MailerSchema>;

function resolveFrom(from: string) {
  const fallbackAddress = process.env.ZEPTOMAIL_FROM_ADDRESS?.trim();
  const fallbackName = process.env.ZEPTOMAIL_FROM_NAME?.trim() || 'Ozer';
  const match = from.trim().match(/^(.*)<([^>]+)>$/);

  if (!match) {
    return {
      address: from.trim() || fallbackAddress || from,
      name: fallbackName.slice(0, 120),
    };
  }

  return {
    address: match[2]?.trim() || fallbackAddress || from,
    name: (match[1]?.trim().replace(/^"|"$/g, '') || fallbackName).slice(
      0,
      120,
    ),
  };
}

export function createZeptomailMailer() {
  return new ZeptomailMailer();
}

/**
 * Transactional mailer using ZeptoMail (EU).
 * Used when ZEPTOMAIL_TOKEN is set so all @kit/mailers callers
 * (OTP, team invites, account deletion) hit Zepto.
 */
class ZeptomailMailer implements Mailer {
  private client: SendMailClient | null = null;

  private getClient() {
    if (this.client) {
      return this.client;
    }

    const token = process.env.ZEPTOMAIL_TOKEN?.trim();

    if (!token) {
      throw new Error(
        'ZEPTOMAIL_TOKEN is not configured. Set the full Send Mail token.',
      );
    }

    this.client = new SendMailClient({
      url: 'api.zeptomail.eu/',
      token,
    });

    return this.client;
  }

  async sendEmail(config: Config) {
    const client = this.getClient();
    const htmlbody =
      'html' in config ? config.html : `<pre>${config.text}</pre>`;
    const textbody = 'text' in config ? config.text : undefined;

    await client.sendMail({
      from: resolveFrom(config.from),
      to: [{ email_address: { address: config.to, name: config.to } }],
      subject: config.subject,
      htmlbody,
      ...(textbody ? { textbody } : {}),
    });
  }
}
