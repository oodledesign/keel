import { createHmac, timingSafeEqual } from 'crypto';

export type LinkedInOrgOAuthStatePayload = {
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
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for LinkedIn OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('linkedin-org-oauth-state-v1')
    .digest('hex');
}

export function signLinkedInOrgOAuthState(
  payload: LinkedInOrgOAuthStatePayload,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyLinkedInOrgOAuthState(
  token: string,
): LinkedInOrgOAuthStatePayload | null {
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
    ) as LinkedInOrgOAuthStatePayload;
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

export type PendingLinkedInOrgs = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  orgs: Array<{ id: string; urn: string; name: string }>;
  exp: number;
};

export function signPendingLinkedInOrgs(payload: PendingLinkedInOrgs): string {
  return signLinkedInOrgOAuthState({
    accountId: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    userId: 'pending-orgs',
    exp: payload.exp,
    returnPath: '/pending',
  });
}

export function verifyPendingLinkedInOrgs(
  token: string,
): PendingLinkedInOrgs | null {
  const state = verifyLinkedInOrgOAuthState(token);
  if (!state || state.userId !== 'pending-orgs') return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(state.accountId, 'base64url').toString('utf8'),
    ) as PendingLinkedInOrgs;
    if (!Array.isArray(parsed.orgs) || typeof parsed.accessToken !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
