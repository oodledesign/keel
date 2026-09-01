import { z } from 'zod';

import { MailerSchema } from '@kit/mailers-shared';

type Config = z.infer<typeof MailerSchema>;

export function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** SES Source must be a bare address; From can still be `Name <email>`. */
export function extractSesSourceAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

export function buildSesRawEmail(config: Config) {
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

  if (config.sesConfigurationSet) {
    headers.push(
      `X-SES-CONFIGURATION-SET: ${sanitizeHeader(config.sesConfigurationSet)}`,
    );
  }

  if (config.sesTenant) {
    headers.push(`X-SES-TENANT: ${sanitizeHeader(config.sesTenant)}`);
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
