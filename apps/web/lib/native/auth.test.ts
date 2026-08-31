import { describe, expect, it } from 'vitest';

import {
  authenticateNativeRequest,
  extractNativeBearerToken,
  looksLikeJwt,
} from './auth';

function requestWithAuth(header: string | null) {
  return new Request('http://localhost/api/native/v1/me', {
    headers: header ? { authorization: header } : undefined,
  });
}

describe('native bearer auth', () => {
  it('extracts a Bearer token', () => {
    expect(
      extractNativeBearerToken(requestWithAuth('Bearer abc.def.ghi')),
    ).toBe('abc.def.ghi');
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const result = await authenticateNativeRequest(requestWithAuth(null));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Missing Bearer token',
    });
  });

  it('returns 401 for a non-JWT bearer token', async () => {
    const result = await authenticateNativeRequest(
      requestWithAuth('Bearer keel_not_a_user_jwt'),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Invalid or expired token',
    });
  });

  it('does not treat recorder-style tokens as JWTs', () => {
    expect(looksLikeJwt('keel_abc')).toBe(false);
    expect(looksLikeJwt('aaa.bbb.ccc')).toBe(true);
  });
});
