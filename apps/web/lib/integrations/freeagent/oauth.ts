import 'server-only';

import { getFreeAgentEnv } from './env';
import {
  signFreeAgentOAuthState,
  verifyFreeAgentOAuthState,
} from './oauth-state';

export type FreeAgentTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export function buildFreeAgentAuthUrl(input: {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
}) {
  const env = getFreeAgentEnv();
  const state = signFreeAgentOAuthState({
    userId: input.userId,
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    returnPath: input.returnPath,
  });

  const url = new URL(`${env.apiBase}/approve_app`);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

export function verifyFreeAgentState(token: string) {
  return verifyFreeAgentOAuthState(token);
}

export async function exchangeFreeAgentCode(code: string) {
  const env = getFreeAgentEnv();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
  });

  const res = await fetch(`${env.apiBase}/token_endpoint`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    throw new Error(
      `FreeAgent token exchange failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as FreeAgentTokenResponse;
}

export async function refreshFreeAgentToken(refreshToken: string) {
  const env = getFreeAgentEnv();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });

  const res = await fetch(`${env.apiBase}/token_endpoint`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    throw new Error(
      `FreeAgent token refresh failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as FreeAgentTokenResponse;
}
