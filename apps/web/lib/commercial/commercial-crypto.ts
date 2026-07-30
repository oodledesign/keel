import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

/**
 * Encrypts portal credentials at rest.
 * Uses TOKEN_ENCRYPTION_KEY (same env as Google Calendar / Videos).
 * TODO: migrate to a dedicated secrets vault when available.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT = 'keel-commercial-portal-v1';

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    /* fall through */
  }

  return scryptSync(raw, SALT, 32);
}

export function encryptCommercialSecret(plain: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be configured to store portal credentials',
      );
    }
    // TODO: always require TOKEN_ENCRYPTION_KEY — plaintext fallback is local scaffolding only
    return plain;
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptCommercialSecret(payload: string): string {
  const key = getKey();
  if (!key) {
    return payload;
  }

  try {
    const buf = Buffer.from(payload, 'base64url');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      return payload;
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    // Likely plaintext stored before encryption was configured
    return payload;
  }
}
