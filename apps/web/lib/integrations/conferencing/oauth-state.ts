import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 10 * 60_000;

export type ConferencingOAuthStatePayload = {
  userId: string;
  accountId: string;
  accountSlug: string;
  provider: 'zoom' | 'teams';
  returnPath: string;
  exp: number;
};

function stateSecret(provider: 'zoom' | 'teams') {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for conferencing OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update(`keel-conferencing-oauth-state-v1:${provider}`)
    .digest('hex');
}

function signPayload(provider: 'zoom' | 'teams', body: string) {
  return createHmac('sha256', stateSecret(provider))
    .update(body)
    .digest('base64url');
}

export function signConferencingOAuthState(
  input: Omit<ConferencingOAuthStatePayload, 'exp'> & { exp?: number },
) {
  const payload: ConferencingOAuthStatePayload = {
    ...input,
    exp: input.exp ?? Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(input.provider, body);
  return `${body}.${sig}`;
}

export function verifyConferencingOAuthState(
  token: string,
  expectedProvider: 'zoom' | 'teams',
): ConferencingOAuthStatePayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  const sig = parts.pop()!;
  const body = parts.join('.');
  const expected = signPayload(expectedProvider, body);

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as ConferencingOAuthStatePayload;

    if (
      parsed.provider !== expectedProvider ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.accountId !== 'string' ||
      typeof parsed.accountSlug !== 'string' ||
      typeof parsed.returnPath !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
