import 'server-only';

import { SendMailClient } from 'zeptomail';

import { isEmailSuppressed } from '~/lib/email/is-suppressed';

// EU data centre for GDPR/data residency.
const client = new SendMailClient({
  url: 'api.zeptomail.eu/',
  token: process.env.ZEPTOMAIL_TOKEN!,
});

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  clientReference?: string;
  listUnsubscribeUrl?: string;
}

function getZeptoMailFrom() {
  const address = process.env.ZEPTOMAIL_FROM_ADDRESS?.trim();
  if (!address) {
    throw new Error(
      'ZEPTOMAIL_FROM_ADDRESS is not configured. Set it in Vercel (e.g. support@ozer.so).',
    );
  }

  return {
    address,
    name: process.env.ZEPTOMAIL_FROM_NAME?.trim() || 'Ozer',
  };
}

export function getTransactionalEmailSender() {
  const { address, name } = getZeptoMailFrom();
  return `${name} <${address}>`;
}

export function getZeptomailDiagnostics() {
  return {
    provider: 'zeptomail',
    fromAddress: process.env.ZEPTOMAIL_FROM_ADDRESS?.trim() ?? null,
    fromName: process.env.ZEPTOMAIL_FROM_NAME?.trim() || 'Ozer',
    tokenConfigured: Boolean(process.env.ZEPTOMAIL_TOKEN?.trim()),
    webhookSecretConfigured: Boolean(
      process.env.ZEPTOMAIL_WEBHOOK_SECRET?.trim(),
    ),
  };
}

export async function sendTransactionalEmail({
  to,
  toName,
  subject,
  htmlBody,
  textBody,
  replyTo,
  clientReference,
  listUnsubscribeUrl,
}: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  if (await isEmailSuppressed(to)) {
    console.warn(`[zeptomail] Skipping suppressed address: ${to}`);
    return { sent: false, reason: 'suppressed' };
  }

  if (!process.env.ZEPTOMAIL_TOKEN?.trim()) {
    throw new Error(
      'ZEPTOMAIL_TOKEN is not configured. Set the full Send Mail token in Vercel.',
    );
  }

  const mimeHeaders: Record<string, string> = {};

  if (clientReference) {
    mimeHeaders['X-Campaign-ID'] = clientReference;
  }

  if (listUnsubscribeUrl) {
    mimeHeaders['List-Unsubscribe'] = `<${listUnsubscribeUrl}>`;
  }

  await client.sendMail({
    from: getZeptoMailFrom(),
    to: [{ email_address: { address: to, name: toName ?? to } }],
    subject,
    htmlbody: htmlBody,
    ...(textBody ? { textbody: textBody } : {}),
    ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
    ...(clientReference ? { client_reference: clientReference } : {}),
    ...(Object.keys(mimeHeaders).length > 0
      ? { mime_headers: mimeHeaders }
      : {}),
  });

  return { sent: true };
}
