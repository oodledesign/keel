import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 15 * 60_000;

export type StarlingOAuthStatePayload = {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
  exp: number;
};

function stateSecret() {
  const starlingExplicit = process.env.STARLING_OAUTH_STATE_SECRET?.trim();
  if (starlingExplicit && starlingExplicit.length >= 16) {
    return starlingExplicit;
  }

  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for Starling OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('keel-starling-oauth-state-v1')
    .digest('hex');
}

function signPayload(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function signStarlingOAuthState(
  input: Omit<StarlingOAuthStatePayload, 'exp'> & { exp?: number },
) {
  const payload: StarlingOAuthStatePayload = {
    ...input,
    exp: input.exp ?? Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(body);
  return `${body}.${sig}`;
}

export function verifyStarlingOAuthState(token: string): StarlingOAuthStatePayload {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new Error('Invalid OAuth state');

  const expected = signPayload(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid OAuth state signature');
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8'),
  ) as StarlingOAuthStatePayload;

  if (payload.exp < Date.now()) throw new Error('OAuth state expired');
  return payload;
}
