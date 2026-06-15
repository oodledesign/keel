import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const LEGACY_KEY_SALT = 'keel-google-auth-token-v1';

/** Matches calendar token crypto: hex, base64(32), or scrypt passphrase. */
function keyFromLegacyMaterial(raw: string): Buffer {
  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // fall through to scrypt
  }

  return scryptSync(raw, LEGACY_KEY_SALT, 32);
}

function getEncryptionKey(): Buffer {
  const googleKey = process.env.GOOGLE_TOKEN_ENC_KEY?.trim();

  if (googleKey) {
    const key = Buffer.from(googleKey, 'base64');

    if (key.length !== 32) {
      throw new Error(
        'GOOGLE_TOKEN_ENC_KEY must base64-decode to exactly 32 bytes',
      );
    }

    return key;
  }

  const legacyKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (legacyKey && legacyKey.length >= 32) {
    return keyFromLegacyMaterial(legacyKey);
  }

  throw new Error(
    'GOOGLE_TOKEN_ENC_KEY or TOKEN_ENCRYPTION_KEY must be configured for Google OAuth token encryption',
  );
}

/** AES-256-GCM: base64(iv12 | authTag16 | ciphertext). */
export function encrypt(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(blob: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(blob, 'base64');

  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error('Invalid encrypted Google token payload');
  }

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
