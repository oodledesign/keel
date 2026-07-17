import { createHmac, timingSafeEqual } from 'crypto';

import { getFeedflowServerEnv } from '~/lib/feedflow/env';

export type FeedflowOAuthStatePayload = {
  provider: 'instagram' | 'tiktok';
  accountId: string;
  userId: string;
  exp: number;
  returnPath: string;
  clientId: string | null;
};

function stateSecret(): string {
  const e = getFeedflowServerEnv();
  if (e.OAUTH_STATE_SECRET && e.OAUTH_STATE_SECRET.length >= 16) {
    return e.OAUTH_STATE_SECRET;
  }
  return createHmac('sha256', e.TOKEN_ENCRYPTION_KEY)
    .update('feedflow-oauth-state-v1')
    .digest('hex');
}

export function signFeedflowOAuthState(
  payload: FeedflowOAuthStatePayload,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyFeedflowOAuthState(
  token: string,
): FeedflowOAuthStatePayload | null {
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
    ) as FeedflowOAuthStatePayload;
    if (
      typeof parsed.accountId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.returnPath !== 'string'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    if (parsed.provider !== 'instagram' && parsed.provider !== 'tiktok') {
      return null;
    }
    return {
      ...parsed,
      clientId: parsed.clientId ?? null,
    };
  } catch {
    return null;
  }
}
