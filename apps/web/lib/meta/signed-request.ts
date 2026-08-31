import { createHmac, timingSafeEqual } from 'node:crypto';

export type MetaSignedRequestPayload = {
  algorithm: string;
  user_id: string;
  issued_at?: number;
  expires?: number;
};

function decodeBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

function encodeBase64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signaturesMatch(expected: Buffer, actual: Buffer): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Verify a Meta `signed_request` against one or more app secrets.
 * Secrets are tried in order (first match wins).
 *
 * @see https://developers.facebook.com/docs/games/gamesonfacebook/login#parsingsr
 */
export function parseMetaSignedRequest(
  signedRequest: string,
  appSecrets: readonly string[],
): MetaSignedRequestPayload | null {
  const trimmed = signedRequest.trim();
  const separator = trimmed.indexOf('.');

  if (separator <= 0 || separator === trimmed.length - 1) {
    return null;
  }

  const encodedSig = trimmed.slice(0, separator);
  const encodedPayload = trimmed.slice(separator + 1);
  const secrets = appSecrets.filter((secret) => secret.length > 0);

  if (secrets.length === 0) {
    return null;
  }

  let actualSig: Buffer;
  try {
    actualSig = decodeBase64Url(encodedSig);
  } catch {
    return null;
  }

  const matched = secrets.some((secret) => {
    const expectedSig = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest();
    return signaturesMatch(expectedSig, actualSig);
  });

  if (!matched) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const algorithm =
    typeof record.algorithm === 'string' ? record.algorithm : '';
  const userId =
    typeof record.user_id === 'string' ? record.user_id.trim() : '';

  if (algorithm.toUpperCase() !== 'HMAC-SHA256' || !userId) {
    return null;
  }

  return {
    algorithm,
    user_id: userId,
    issued_at:
      typeof record.issued_at === 'number' ? record.issued_at : undefined,
    expires: typeof record.expires === 'number' ? record.expires : undefined,
  };
}

export function createMetaSignedRequest(
  payload: MetaSignedRequestPayload,
  appSecret: string,
): string {
  const encodedPayload = encodeBase64Url(
    Buffer.from(JSON.stringify(payload), 'utf8'),
  );
  const encodedSig = encodeBase64Url(
    createHmac('sha256', appSecret).update(encodedPayload).digest(),
  );

  return `${encodedSig}.${encodedPayload}`;
}
