import 'server-only';

import { getOptionalWebflow } from '~/lib/feedflow/env';

/** Enough to list sites and read/write CMS items. */
export const WEBFLOW_OAUTH_SCOPES = ['sites:read', 'cms:read', 'cms:write'];

export function buildWebflowAuthUrl(state: string): string {
  const config = getOptionalWebflow();
  if (!config) throw new Error('Webflow sign-in is not configured');
  const url = new URL('https://webflow.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', WEBFLOW_OAUTH_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

/** Webflow access tokens do not expire; there is no refresh token. */
export async function exchangeWebflowCode(code: string): Promise<string> {
  const config = getOptionalWebflow();
  if (!config) throw new Error('Webflow sign-in is not configured');

  const response = await fetch('https://api.webflow.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'Webflow sign-in failed',
    );
  }
  return json.access_token;
}
