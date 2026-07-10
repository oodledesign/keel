import 'server-only';

import {
  getOptionalTeamsOAuthEnv,
  getTeamsOAuthEnv,
} from '@kit/scheduling/conferencing';

import {
  signConferencingOAuthState,
  verifyConferencingOAuthState,
} from '../conferencing/oauth-state';

const SCOPES = [
  'offline_access',
  'openid',
  'email',
  'User.Read',
  'OnlineMeetings.ReadWrite',
].join(' ');

export type TeamsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export function isTeamsConfigured() {
  return Boolean(getOptionalTeamsOAuthEnv());
}

export function buildTeamsAuthUrl(input: {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
}) {
  const env = getTeamsOAuthEnv();
  const state = signConferencingOAuthState({
    userId: input.userId,
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    provider: 'teams',
    returnPath: input.returnPath,
  });

  const url = new URL(
    `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export function verifyTeamsState(token: string) {
  return verifyConferencingOAuthState(token, 'teams');
}

export async function exchangeTeamsCode(
  code: string,
): Promise<TeamsTokenResponse> {
  const env = getTeamsOAuthEnv();
  const tokenUrl = `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    code,
    redirect_uri: env.redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Teams token exchange failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as TeamsTokenResponse;
}

export async function fetchTeamsAccountEmail(accessToken: string) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    mail?: string | null;
    userPrincipalName?: string | null;
  };
  return data.mail ?? data.userPrincipalName ?? null;
}
