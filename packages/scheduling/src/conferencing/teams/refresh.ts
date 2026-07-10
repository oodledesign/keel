import { getTeamsOAuthEnv } from './env';

export type TeamsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export async function refreshTeamsAccessToken(
  refreshToken: string,
): Promise<TeamsTokenResponse> {
  const env = getTeamsOAuthEnv();
  const tokenUrl = `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: [
      'offline_access',
      'openid',
      'email',
      'User.Read',
      'OnlineMeetings.ReadWrite',
    ].join(' '),
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Teams token refresh failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as TeamsTokenResponse;
}
