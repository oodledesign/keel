import { afterEach, describe, expect, it, vi } from 'vitest';

import { decrypt, encrypt } from './crypto';

describe('google-auth crypto', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips plaintext with AES-256-GCM layout iv(12)|tag(16)|cipher', () => {
    vi.stubEnv('GOOGLE_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));

    const plain = 'ya29.access-token-example';
    const blob = encrypt(plain);

    expect(Buffer.from(blob, 'base64').length).toBeGreaterThan(
      IV_TAG_MIN_LEN(),
    );

    expect(decrypt(blob)).toBe(plain);
  });

  it('falls back to TOKEN_ENCRYPTION_KEY when GOOGLE_TOKEN_ENC_KEY is unset', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));

    const plain = 'ya29.legacy-calendar-key-fallback';
    const blob = encrypt(plain);

    expect(decrypt(blob)).toBe(plain);
  });
});

function IV_TAG_MIN_LEN() {
  return 12 + 16 + 1;
}
