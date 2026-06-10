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

function getSecret() {
  const secret =
    process.env.FREEAGENT_OAUTH_STATE_SECRET?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error('Missing OAuth state secret');
  return secret;
}

function signPayload(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function signFreeAgentOAuthState(input: Omit<FreeAgentOAuthStatePayload, 'exp'> & { exp?: number }) {
  const payload: FreeAgentOAuthStatePayload = {
    ...input,
    exp: input.exp ?? Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(body);
  return `${body}.${sig}`;
}

export function verifyFreeAgentOAuthState(token: string): FreeAgentOAuthStatePayload {
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
