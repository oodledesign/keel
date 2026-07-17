import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

/**
 * Encrypts Zoom/Teams tokens at rest in `conferencing_connections`.
 * Uses a distinct salt from Google Calendar so ciphertext is not interchangeable.
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT = 'keel-conferencing-token-v1';
/** Prefix so we can detect encrypted payloads vs legacy plaintext rows. */
export const CONFERENCING_TOKEN_PREFIX = 'enc:v1:';

function getTokenEncryptionKey(): string {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be configured to store conferencing tokens',
    );
  }
  return raw;
}

function getKey(): Buffer {
  const raw = getTokenEncryptionKey();
  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through
  }
  return scryptSync(raw, SALT, 32);
}

export function encryptConferencingSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString('base64url');
  return `${CONFERENCING_TOKEN_PREFIX}${payload}`;
}

export function decryptConferencingSecret(payload: string): string {
  if (!payload.startsWith(CONFERENCING_TOKEN_PREFIX)) {
    // Legacy plaintext rows from early schema — still usable until reconnected.
    return payload;
  }

  const key = getKey();
  const buf = Buffer.from(
    payload.slice(CONFERENCING_TOKEN_PREFIX.length),
    'base64url',
  );
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
