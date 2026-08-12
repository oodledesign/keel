import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT = 'ozer-impersonation-restore-v1';

export type ImpersonationRestoreTokens = {
  accessToken: string;
  refreshToken: string;
};

function getMasterKey(): Buffer {
  const raw =
    process.env.IMPERSONATION_RESTORE_SECRET?.trim() ||
    process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'IMPERSONATION_RESTORE_SECRET or TOKEN_ENCRYPTION_KEY must be configured for impersonation restore',
      );
    }

    // Local-only deterministic key so restore works without env wiring.
    return scryptSync('ozer-local-impersonation-dev', SALT, 32);
  }

  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw.slice(0, 64), 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    /* fall through */
  }

  return scryptSync(raw, SALT, 32);
}

function deriveKey(info: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', getMasterKey(), Buffer.alloc(0), info, 32),
  );
}

function getAesKey(): Buffer {
  return deriveKey('ozer-impersonation-aes');
}

function getHmacSecret(): Buffer {
  return deriveKey('ozer-impersonation-hmac');
}

export function encryptImpersonationPayload(
  tokens: ImpersonationRestoreTokens,
): string {
  const key = getAesKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plain = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptImpersonationPayload(
  payload: string,
): ImpersonationRestoreTokens {
  const key = getAesKey();
  const buf = Buffer.from(payload, 'base64url');

  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Invalid impersonation restore payload');
  }

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString('utf8');

  const parsed = JSON.parse(plain) as Partial<ImpersonationRestoreTokens>;

  if (!parsed.accessToken || !parsed.refreshToken) {
    throw new Error('Invalid impersonation restore payload contents');
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
  };
}

export function signImpersonationCookieValue(sessionId: string): string {
  const mac = createHmac('sha256', getHmacSecret())
    .update(sessionId)
    .digest('base64url');

  return `${sessionId}.${mac}`;
}

export function verifyImpersonationCookieValue(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const [sessionId, mac] = value.split('.');

  if (!sessionId || !mac) {
    return null;
  }

  const expected = createHmac('sha256', getHmacSecret())
    .update(sessionId)
    .digest('base64url');

  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);

  if (
    macBuf.length !== expectedBuf.length ||
    !timingSafeEqual(macBuf, expectedBuf)
  ) {
    return null;
  }

  return sessionId;
}
