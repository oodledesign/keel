import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignaturesMsOAuthStateV2 = {
  v: 2;
  accountId: string;
  slug: string | null;
  inviteId: string | null;
  flow: 'member' | 'delegated_invite';
  exp: number;
};

function stateSecret() {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey =
    process.env.AZURE_CLIENT_SECRET?.trim() ||
    process.env.AZURE_SECRET_VALUE?.trim() ||
    process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET, AZURE_CLIENT_SECRET, or TOKEN_ENCRYPTION_KEY is required for Signatures OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('keel-signatures-ms-oauth-state-v2')
    .digest('hex');
}

export function signSignaturesMsOAuthState(payload: SignaturesMsOAuthStateV2) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignaturesMsOAuthState(
  token: string,
): SignaturesMsOAuthStateV2 | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const sig = parts.pop()!;
  const body = parts.join('.');
  const expected = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<SignaturesMsOAuthStateV2>;

    if (
      parsed.v !== 2 ||
      typeof parsed.accountId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(parsed.accountId) ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp ||
      (parsed.flow !== 'member' && parsed.flow !== 'delegated_invite')
    ) {
      return null;
    }

    const slug =
      typeof parsed.slug === 'string' && parsed.slug.trim().length > 0
        ? parsed.slug.trim()
        : null;

    const inviteId =
      typeof parsed.inviteId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(parsed.inviteId)
        ? parsed.inviteId
        : null;

    if (parsed.flow === 'delegated_invite' && !inviteId) {
      return null;
    }

    return {
      v: 2,
      accountId: parsed.accountId,
      slug,
      inviteId,
      flow: parsed.flow,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
