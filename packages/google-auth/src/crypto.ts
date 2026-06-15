import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY?.trim();

  if (!raw) {
    throw new Error(
      'GOOGLE_TOKEN_ENC_KEY must be configured for Google OAuth token encryption',
    );
  }

  const key = Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'GOOGLE_TOKEN_ENC_KEY must base64-decode to exactly 32 bytes',
    );
  }

  return key;
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
