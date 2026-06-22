import 'server-only';

import { randomUUID } from 'crypto';

import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { sanitizeEmailSender } from '@kit/mailers';

export function getSesConfig() {
  const region = process.env.AWS_REGION ?? process.env.SES_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const from =
    process.env.SES_FROM_EMAIL ??
    process.env.SES_FROM_ADDRESS ??
    process.env.EMAIL_SENDER;

  if (!region || !accessKeyId || !secretAccessKey || !from) {
    throw new Error(
      'Missing SES configuration. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and EMAIL_SENDER.',
    );
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    from: sanitizeEmailSender(from),
  };
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function normalizeMimeBody(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function encodeMimePartBase64(value: string) {
  const normalized = normalizeMimeBody(value);
  const encoded = Buffer.from(normalized, 'utf8').toString('base64');
  return encoded.match(/.{1,76}/g)?.join('\r\n') ?? encoded;
}

function extractEnvelopeFrom(from: string) {
  const match = from.match(/<([^>]+)>/);
  return match?.[1]?.trim() ?? from.trim();
}

function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  campaignId?: string;
  listUnsubscribeUrl?: string;
}) {
  const boundary = `=_Keel_${randomUUID().replace(/-/g, '')}`;
  const headers = [
    `From: ${sanitizeHeader(params.from)}`,
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${encodeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (params.campaignId) {
    headers.splice(4, 0, `X-Campaign-ID: ${sanitizeHeader(params.campaignId)}`);
  }

  if (params.listUnsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${params.listUnsubscribeUrl}>`);
  }

  const plainPart = encodeMimePartBase64(params.text);
  const htmlPart = encodeMimePartBase64(params.html);

  return [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    plainPart,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlPart,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/**
 * Send via the same SES SendRawEmail path used by admin campaigns (proven in production).
 */
export async function sendSesRawEmail(params: {
  to: string;
  subject: string;
  from?: string;
  html?: string;
  text?: string;
  campaignId?: string;
  listUnsubscribeUrl?: string;
}): Promise<string> {
  const config = getSesConfig();
  const from = params.from ?? config.from;
  const html = params.html ?? (params.text ? `<pre>${params.text}</pre>` : '');
  const text = params.text ?? (params.html ? htmlToPlainText(params.html) : '');

  if (!html && !text) {
    throw new Error('Email must include html or text content.');
  }

  const client = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await client.send(
    new SendRawEmailCommand({
      Source: extractEnvelopeFrom(from),
      Destinations: [params.to],
      RawMessage: {
        Data: Buffer.from(
          buildRawEmail({
            from,
            to: params.to,
            subject: params.subject,
            html,
            text,
            campaignId: params.campaignId,
            listUnsubscribeUrl: params.listUnsubscribeUrl,
          }),
          'utf8',
        ),
      },
    }),
  );

  return from;
}
