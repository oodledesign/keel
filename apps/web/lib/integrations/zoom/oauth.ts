import 'server-only';

import {
  getOptionalZoomOAuthEnv,
  getZoomOAuthEnv,
} from '@kit/scheduling/conferencing';

import {
  signConferencingOAuthState,
  verifyConferencingOAuthState,
} from '../conferencing/oauth-state';

const AUTH_URL = 'https://zoom.us/oauth/authorize';
const TOKEN_URL = 'https://zoom.us/oauth/token';

/** Legacy + granular scopes — configure matching scopes on the Zoom app. */
const SCOPES = ['meeting:write', 'user:read'].join(' ');

export type ZoomTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export function isZoomConfigured() {
  return Boolean(getOptionalZoomOAuthEnv());
}

export function buildZoomAuthUrl(input: {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
}) {
  const env = getZoomOAuthEnv();
  const state = signConferencingOAuthState({
    userId: input.userId,
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    provider: 'zoom',
    returnPath: input.returnPath,
  });

  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);
  // Zoom accepts space-delimited scopes via the Marketplace app config;
  // some apps ignore the query param — still send for clarity.
  url.searchParams.set('scope', SCOPES);
  return url.toString();
}

export function verifyZoomState(token: string) {
  return verifyConferencingOAuthState(token, 'zoom');
}

export async function exchangeZoomCode(code: string): Promise<ZoomTokenResponse> {
  const env = getZoomOAuthEnv();
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString(
    'base64',
  );
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Zoom token exchange failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as ZoomTokenResponse;
}

export async function fetchZoomAccountEmail(accessToken: string) {
  const res = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}
