import 'server-only';

import { getStarlingEnv } from './env';
import {
  signStarlingOAuthState,
  verifyStarlingOAuthState,
} from './oauth-state';

export type StarlingTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

const STARLING_SCOPES = [
  'account-list:read',
  'account:read',
  'balance:read',
  'transaction:read',
].join(' ');

export function buildStarlingAuthUrl(input: {
  userId: string;
  accountId: string;
  accountSlug: string;
  returnPath: string;
}) {
  const env = getStarlingEnv();
  const state = signStarlingOAuthState({
    userId: input.userId,
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    returnPath: input.returnPath,
  });

  const url = new URL(env.oauthBase);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', STARLING_SCOPES);
  return url.toString();
}

export function verifyStarlingState(token: string) {
  return verifyStarlingOAuthState(token);
}

async function exchangeTokenParams(params: URLSearchParams) {
  const env = getStarlingEnv();
  const res = await fetch(env.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Ozer/1.0',
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(
      `Starling token exchange failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as StarlingTokenResponse;
}

export async function exchangeStarlingCode(code: string) {
  const env = getStarlingEnv();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
  });
  return exchangeTokenParams(params);
}

export async function refreshStarlingToken(refreshToken: string) {
  const env = getStarlingEnv();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
  return exchangeTokenParams(params);
}
