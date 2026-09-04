import 'server-only';

import { X509Certificate, createHash, createVerify } from 'node:crypto';

/**
 * Verify an AWS SNS message signature (SignatureVersion 1).
 * Uses node:crypto on the server only — never import from client components.
 *
 * Spec: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */

const CERT_CACHE = new Map<string, { pem: string; fetchedAt: number }>();
const CERT_TTL_MS = 60 * 60 * 1000;

function buildSigningString(fields: Record<string, string>, keys: string[]) {
  let out = '';
  for (const key of keys) {
    const value = fields[key];
    if (value == null) continue;
    out += `${key}\n${value}\n`;
  }
  return out;
}

function signingKeysForType(type: string): string[] {
  if (type === 'Notification') {
    return ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
  }
  if (
    type === 'SubscriptionConfirmation' ||
    type === 'UnsubscribeConfirmation'
  ) {
    return [
      'Message',
      'MessageId',
      'SubscribeURL',
      'Timestamp',
      'Token',
      'TopicArn',
      'Type',
    ];
  }
  return [];
}

function isAllowedCertUrl(urlString: string) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  // SNS signing certs are hosted on *.amazonaws.com
  if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/i.test(url.hostname)) {
    return false;
  }
  if (!url.pathname.endsWith('.pem')) return false;
  return true;
}

async function fetchSigningCert(certUrl: string): Promise<string> {
  const cached = CERT_CACHE.get(certUrl);
  if (cached && Date.now() - cached.fetchedAt < CERT_TTL_MS) {
    return cached.pem;
  }

  const response = await fetch(certUrl, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SNS signing cert (${response.status})`);
  }

  const pem = await response.text();
  if (!pem.includes('BEGIN CERTIFICATE')) {
    throw new Error('SNS signing cert response was not a PEM certificate');
  }

  CERT_CACHE.set(certUrl, { pem, fetchedAt: Date.now() });
  return pem;
}

export type SnsMessageFields = {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Timestamp: string;
  Signature: string;
  SigningCertURL: string;
  SignatureVersion?: string;
  Message?: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
  [key: string]: string | undefined;
};

export async function verifySnsMessageSignature(
  message: SnsMessageFields,
): Promise<boolean> {
  if (message.SignatureVersion && message.SignatureVersion !== '1') {
    // Version 2 uses different hashing; reject unknown versions in v1.
    return false;
  }

  if (!isAllowedCertUrl(message.SigningCertURL)) {
    return false;
  }

  const keys = signingKeysForType(message.Type);
  if (keys.length === 0) return false;

  const fields: Record<string, string> = {};
  for (const key of keys) {
    const value = message[key];
    if (typeof value === 'string') {
      fields[key] = value;
    }
  }

  // Subject is optional on Notification
  const signingKeys = keys.filter((key) => key in fields);
  const signingString = buildSigningString(fields, signingKeys);

  const pem = await fetchSigningCert(message.SigningCertURL);

  // Ensure the cert parses
  try {
    // eslint-disable-next-line no-new
    new X509Certificate(pem);
  } catch {
    return false;
  }

  const verifier = createVerify('RSA-SHA1');
  verifier.update(signingString, 'utf8');
  verifier.end();

  try {
    return verifier.verify(pem, message.Signature, 'base64');
  } catch {
    return false;
  }
}

export function snsSkipVerifyEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.SES_SNS_SKIP_VERIFY === '1';
}

/** Stable hash helper for tests / logging (never used as auth). */
export function hashSnsMessageId(messageId: string) {
  return createHash('sha256').update(messageId).digest('hex').slice(0, 16);
}
