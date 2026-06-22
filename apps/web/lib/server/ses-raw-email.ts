import 'server-only';

import { randomUUID } from 'crypto';

import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { getMailer, sanitizeEmailSender } from '@kit/mailers';

export type OutboundEmailTransport = 'ses-api' | 'smtp';

export function getEmailSender() {
  const from =
    process.env.SES_FROM_EMAIL ??
    process.env.SES_FROM_ADDRESS ??
    process.env.EMAIL_SENDER;

  if (!from?.trim()) {
    throw new Error(
      'EMAIL_SENDER is not configured. Set EMAIL_SENDER in Vercel (e.g. Ozer <hi@ozer.so>).',
    );
  }

  return sanitizeEmailSender(from);
}

/** Which transport Ozer uses for outbound mail (matches Supabase when smtp). */
export function resolveOutboundTransport(): OutboundEmailTransport {
  if (process.env.MAILER_PROVIDER === 'nodemailer' && process.env.EMAIL_HOST?.trim()) {
    return 'smtp';
  }

  return 'ses-api';
}

export function getOutboundEmailDiagnostics() {
  const transport = resolveOutboundTransport();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() ?? '';
  const smtpUser = process.env.EMAIL_USER?.trim() ?? '';

  return {
    mailerProvider: process.env.MAILER_PROVIDER ?? '(unset, defaults to nodemailer in code)',
    transport,
    region: process.env.AWS_REGION ?? process.env.SES_REGION ?? null,
    emailSender: getEmailSender(),
    awsAccessKeyIdSuffix: accessKeyId ? accessKeyId.slice(-4) : null,
    smtpHost: process.env.EMAIL_HOST ?? null,
    smtpUserSuffix: smtpUser ? smtpUser.slice(-4) : null,
    hint:
      transport === 'ses-api'
        ? 'App uses SES API (AWS_ACCESS_KEY_ID). Supabase magic links use SES SMTP — different credentials. If API fails but SMTP works, set MAILER_PROVIDER=nodemailer and copy Supabase SMTP settings into Vercel.'
        : 'App uses SES SMTP (same path as Supabase Auth).',
  };
}

export function getSesApiConfig() {
  const region = process.env.AWS_REGION ?? process.env.SES_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing SES API configuration. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in Vercel, or switch to MAILER_PROVIDER=nodemailer with SES SMTP credentials (same as Supabase).',
    );
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    from: getEmailSender(),
  };
}

/** @deprecated use getSesApiConfig */
export function getSesConfig() {
  return getSesApiConfig();
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

async function sendViaSmtp(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}) {
  const mailer = await getMailer();
  await mailer.sendEmail({
    to: params.to,
    from: params.from,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

async function sendViaSesApi(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  campaignId?: string;
  listUnsubscribeUrl?: string;
}) {
  const config = getSesApiConfig();
  const client = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await client.send(
    new SendRawEmailCommand({
      Source: extractEnvelopeFrom(params.from),
      Destinations: [params.to],
      RawMessage: {
        Data: Buffer.from(buildRawEmail(params), 'utf8'),
      },
    }),
  );
}

/**
 * Send outbound mail via SES SMTP (Supabase path) or SES API (IAM access keys).
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
  const from = params.from ?? getEmailSender();
  const html = params.html ?? (params.text ? `<pre>${params.text}</pre>` : '');
  const text = params.text ?? (params.html ? htmlToPlainText(params.html) : '');

  if (!html && !text) {
    throw new Error('Email must include html or text content.');
  }

  const payload = {
    to: params.to,
    from,
    subject: params.subject,
    html,
    text,
    campaignId: params.campaignId,
    listUnsubscribeUrl: params.listUnsubscribeUrl,
  };

  if (resolveOutboundTransport() === 'smtp') {
    await sendViaSmtp(payload);
  } else {
    await sendViaSesApi(payload);
  }

  return from;
}
