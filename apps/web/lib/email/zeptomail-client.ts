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
  /** Optional override; defaults to ZEPTOMAIL_FROM_* */
  from?: string;
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

function resolveFrom(from?: string) {
  const fallback = getZeptoMailFrom();
  if (!from?.trim()) return fallback;

  const match = from.trim().match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return { address: from.trim(), name: fallback.name };
  }

  const name = match[1]?.trim().replace(/^"|"$/g, '') || fallback.name;
  const address = match[2]?.trim() || fallback.address;
  return { address, name: name.slice(0, 120) };
}

export function getTransactionalEmailSender(displayName?: string) {
  const { address, name } = getZeptoMailFrom();
  return `${(displayName?.trim() || name).slice(0, 120)} <${address}>`;
}

/** Resolve a From header using ZeptoMail or EMAIL_SENDER (Resend fallback). */
export function resolveTransactionalEmailFrom(
  displayName?: string,
): string | null {
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const name = (displayName?.trim() || productName).slice(0, 120);

  if (process.env.ZEPTOMAIL_FROM_ADDRESS?.trim()) {
    try {
      return getTransactionalEmailSender(name);
    } catch {
      return null;
    }
  }

  const envSender = process.env.EMAIL_SENDER?.trim();
  if (!envSender) {
    return null;
  }

  const match = envSender.match(/^([^<]+)<([^>]+)>$/);
  const address = match?.[2]?.trim() ?? envSender;
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

export type ZeptoMailAttachment = {
  name: string;
  content: string;
  mimeType: string;
};

export async function sendTransactionalEmail({
  to,
  toName,
  subject,
  htmlBody,
  textBody,
  replyTo,
  from,
  clientReference,
  listUnsubscribeUrl,
  attachments,
}: SendEmailParams & {
  attachments?: ZeptoMailAttachment[];
}): Promise<{ sent: boolean; reason?: string }> {
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
    from: resolveFrom(from),
    to: [{ email_address: { address: to, name: toName ?? to } }],
    subject,
    htmlbody: htmlBody,
    ...(textBody ? { textbody: textBody } : {}),
    ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
    ...(clientReference ? { client_reference: clientReference } : {}),
    ...(Object.keys(mimeHeaders).length > 0
      ? { mime_headers: mimeHeaders }
      : {}),
    ...(attachments && attachments.length > 0
      ? {
          attachments: attachments.map((file) => ({
            name: file.name,
            content: file.content,
            mime_type: file.mimeType,
          })),
        }
      : {}),
  } as Parameters<typeof client.sendMail>[0]);

  return { sent: true };
}
