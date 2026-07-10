import { getZoomOAuthEnv } from './env';

const TOKEN_URL = 'https://zoom.us/oauth/token';

export type ZoomTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export async function refreshZoomAccessToken(
  refreshToken: string,
): Promise<ZoomTokenResponse> {
  const env = getZoomOAuthEnv();
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString(
    'base64',
  );
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
      `Zoom token refresh failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as ZoomTokenResponse;
}
