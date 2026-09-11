import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canEncryptDynamicsSecrets,
  decryptDynamicsSecret,
  encryptDynamicsSecret,
} from './crypto';

describe('dynamics crypto', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips a client secret with TOKEN_ENCRYPTION_KEY', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64'));

    const plain = 'azure-client-secret-value';
    const blob = encryptDynamicsSecret(plain);

    expect(blob).not.toContain(plain);
    expect(decryptDynamicsSecret(blob)).toBe(plain);
    expect(canEncryptDynamicsSecrets()).toBe(true);
  });
});
