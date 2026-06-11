import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

import type { QuickActionTokenPayload } from './types';

const TOKEN_TTL_MS = 15 * 60_000;

function stateSecret() {
  const explicit = process.env.QUICK_ACTION_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const oauth = process.env.OAUTH_STATE_SECRET?.trim();
  if (oauth && oauth.length >= 16) {
    return oauth;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'QUICK_ACTION_SECRET, OAUTH_STATE_SECRET, or TOKEN_ENCRYPTION_KEY is required for quick actions',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('keel-quick-action-v1')
    .digest('hex');
}

function signPayload(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function signQuickActionToken(
  input: Omit<QuickActionTokenPayload, 'exp'> & { exp?: number },
): string {
  const payload: QuickActionTokenPayload = {
    ...input,
    exp: input.exp ?? Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(body);
  return `${body}.${sig}`;
}

export function verifyQuickActionToken(token: string): QuickActionTokenPayload {
  const [body, sig] = token.split('.');
  if (!body || !sig) {
    throw new Error('Invalid action token');
  }

  const expected = signPayload(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid action token signature');
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8'),
  ) as QuickActionTokenPayload;

  if (payload.exp < Date.now()) {
    throw new Error('Action token expired');
  }

  return payload;
}
