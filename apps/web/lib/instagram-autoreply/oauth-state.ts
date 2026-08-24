import { createHmac, timingSafeEqual } from 'crypto';

import { getFeedflowServerEnv } from '~/lib/feedflow/env';

export type IgAutoreplyOAuthStatePayload = {
  accountId: string;
  userId: string;
  exp: number;
  returnPath: string;
};

/** Relative app path only — blocks protocol-relative open redirects (`//evil.com`). */
export function isSafeOAuthReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

function stateSecret(): string {
  try {
    const e = getFeedflowServerEnv();
    if (e.OAUTH_STATE_SECRET && e.OAUTH_STATE_SECRET.length >= 16) {
      return e.OAUTH_STATE_SECRET;
    }
    return createHmac('sha256', e.TOKEN_ENCRYPTION_KEY)
      .update('instagram-autoreply-oauth-state-v1')
      .digest('hex');
  } catch {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY is required for OAuth state');
    }
    return createHmac('sha256', key)
      .update('instagram-autoreply-oauth-state-v1')
      .digest('hex');
  }
}

export function signIgAutoreplyOAuthState(
  payload: IgAutoreplyOAuthStatePayload,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyIgAutoreplyOAuthState(
  token: string,
): IgAutoreplyOAuthStatePayload | null {
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
    ) as IgAutoreplyOAuthStatePayload;
    if (
      typeof parsed.accountId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.returnPath !== 'string'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
