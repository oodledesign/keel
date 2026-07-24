import { createHmac, timingSafeEqual } from 'crypto';

export type GoogleOAuthStatePayload = {
  userId: string;
  returnPath: string;
  exp: number;
  mailboxKind?: 'business' | 'personal';
};

function stateSecret() {
  const explicit = process.env.OAUTH_STATE_SECRET?.trim();

  if (explicit && explicit.length >= 16) {
    return explicit;
  }

  const tokenKey =
    process.env.GOOGLE_TOKEN_ENC_KEY?.trim() ||
    process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (!tokenKey || tokenKey.length < 16) {
    throw new Error(
      'OAUTH_STATE_SECRET, GOOGLE_TOKEN_ENC_KEY, or TOKEN_ENCRYPTION_KEY is required for Google OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    .update('keel-google-oauth-state-v1')
    .digest('hex');
}

export function signGoogleOAuthState(payload: GoogleOAuthStatePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');

  return `${body}.${sig}`;
}

export function verifyGoogleOAuthState(
  token: string,
): GoogleOAuthStatePayload | null {
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
    ) as GoogleOAuthStatePayload;

    if (
      typeof parsed.userId !== 'string' ||
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

export function safeReturnPath(
  payload: GoogleOAuthStatePayload | null,
  fallback: string,
) {
  if (!payload?.returnPath?.startsWith('/')) {
    return fallback;
  }

  return payload.returnPath;
}
