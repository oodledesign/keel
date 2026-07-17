import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 15 * 60_000;

export type FreeAgentOAuthStatePayload = {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
  exp: number;
};

function stateSecret() {
  const freeAgentExplicit = process.env.FREEAGENT_OAUTH_STATE_SECRET?.trim();
  if (freeAgentExplicit && freeAgentExplicit.length >= 16) {
    return freeAgentExplicit;
  }

  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for FreeAgent OAuth state',
    );
  }

  return (
    createHmac('sha256', tokenKey)
      // keep legacy salt string — changing breaks in-flight OAuth state
      .update('keel-freeagent-oauth-state-v1')
      .digest('hex')
  );
}

function signPayload(payload: string) {
  return createHmac('sha256', stateSecret())
    .update(payload)
    .digest('base64url');
}

export function signFreeAgentOAuthState(
  input: Omit<FreeAgentOAuthStatePayload, 'exp'> & { exp?: number },
) {
  const payload: FreeAgentOAuthStatePayload = {
    ...input,
    exp: input.exp ?? Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(body);
  return `${body}.${sig}`;
}

export function verifyFreeAgentOAuthState(
  token: string,
): FreeAgentOAuthStatePayload {
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
  ) as FreeAgentOAuthStatePayload;

  if (payload.exp < Date.now()) throw new Error('OAuth state expired');
  return payload;
}
