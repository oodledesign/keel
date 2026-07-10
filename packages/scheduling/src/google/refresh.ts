import { getGoogleCalendarOAuthEnv } from './oauth';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export async function refreshGoogleCalendarAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const env = getGoogleCalendarOAuthEnv();
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
