import { createHmac, timingSafeEqual } from 'crypto';

export type GoogleCalendarOAuthStatePayload = {
  userId: string;
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
      'OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for Google OAuth state',
    );
  }

  return createHmac('sha256', tokenKey)
    // keep legacy salt string — changing breaks in-flight OAuth state
    .update('keel-google-calendar-oauth-state-v1')
    .digest('hex');
}

export function signGoogleCalendarOAuthState(
  payload: GoogleCalendarOAuthStatePayload,
) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGoogleCalendarOAuthState(
  token: string,
): GoogleCalendarOAuthStatePayload | null {
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
    ) as GoogleCalendarOAuthStatePayload;
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
