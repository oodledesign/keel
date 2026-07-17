import { getGoogleCalendarEnv } from './env';
import {
  type GoogleCalendarOAuthStatePayload,
  signGoogleCalendarOAuthState,
  verifyGoogleCalendarOAuthState,
} from './oauth-state';
import type { GoogleTokenResponse } from './types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function buildGoogleCalendarAuthUrl(input: {
  userId: string;
  returnPath: string;
}) {
  const env = getGoogleCalendarEnv();
  const state = signGoogleCalendarOAuthState({
    userId: input.userId,
    returnPath: input.returnPath,
    exp: Date.now() + 10 * 60_000,
  });

  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  // consent keeps refresh tokens; select_account lets users add a second inbox
  url.searchParams.set('prompt', 'consent select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

export function verifyGoogleCalendarState(token: string) {
  return verifyGoogleCalendarOAuthState(token);
}

export async function exchangeGoogleCalendarCode(code: string) {
  const env = getGoogleCalendarEnv();
  const params = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    throw new Error(
      `Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleCalendarToken(refreshToken: string) {
  const env = getGoogleCalendarEnv();
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Google token refresh failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchGoogleAccountIdentity(accessToken: string): Promise<{
  sub: string;
  email: string | null;
}> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Google userinfo failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    sub?: string;
    email?: string;
  };

  const sub = body.sub?.trim();
  if (!sub) {
    throw new Error('Google userinfo did not return an account id');
  }

  return {
    sub,
    email: body.email?.trim().toLowerCase() || null,
  };
}

export function stateReturnPath(
  payload: GoogleCalendarOAuthStatePayload | null,
  fallback: string,
) {
  if (!payload?.returnPath?.startsWith('/')) {
    return fallback;
  }
  return payload.returnPath;
}
