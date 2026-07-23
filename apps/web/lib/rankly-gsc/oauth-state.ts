import { createHmac, timingSafeEqual } from 'crypto';

export type GscOAuthStatePayload = {
  userId: string;
  accountId: string;
  accountSlug: string;
  projectId: string;
  returnPath: string;
  exp: number;
};

function stateSecret() {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for Google Search Console OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('keel-rankly-gsc-oauth-state-v1')
    .digest('hex');
}

export function signGscOAuthState(
  payload: Omit<GscOAuthStatePayload, 'exp'> & { exp?: number },
) {
  const bodyPayload: GscOAuthStatePayload = {
    ...payload,
    exp: payload.exp ?? Date.now() + 10 * 60_000,
  };
  const body = Buffer.from(JSON.stringify(bodyPayload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGscOAuthState(
  token: string,
): GscOAuthStatePayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  const sig = parts.pop()!;
  const body = parts.join('.');
  const expected = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

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
    ) as GscOAuthStatePayload;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.accountId !== 'string' ||
      typeof parsed.accountSlug !== 'string' ||
      typeof parsed.projectId !== 'string' ||
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
