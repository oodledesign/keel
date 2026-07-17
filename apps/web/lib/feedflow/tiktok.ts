import { getOptionalTikTok } from '~/lib/feedflow/env';

export function buildTikTokAuthUrl(state: string): string {
  const cfg = getOptionalTikTok();
  if (!cfg) throw new Error('TikTok is not configured');
  const params = new URLSearchParams({
    client_key: cfg.clientKey,
    redirect_uri: cfg.redirectUri,
    scope: 'user.info.basic,video.list',
    response_type: 'code',
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  openId: string;
}> {
  const cfg = getOptionalTikTok();
  if (!cfg) throw new Error('TikTok is not configured');
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'TikTok token exchange failed',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 86400,
    openId: json.open_id ?? '',
  };
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const cfg = getOptionalTikTok();
  if (!cfg) throw new Error('TikTok is not configured');
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'TikTok refresh failed',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in ?? 86400,
  };
}

export type TikTokVideo = {
  id: string;
  title?: string;
  cover_image_url?: string;
  share_url?: string;
  create_time?: number;
  like_count?: number;
  view_count?: number;
};

export async function fetchTikTokVideos(
  accessToken: string,
  maxCount = 20,
): Promise<TikTokVideo[]> {
  const res = await fetch('https://open.tiktokapis.com/v2/video/list/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_count: maxCount,
      fields: [
        'id',
        'title',
        'cover_image_url',
        'share_url',
        'create_time',
        'like_count',
        'view_count',
      ],
    }),
  });
  const json = (await res.json()) as {
    data?: { videos?: TikTokVideo[] };
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'TikTok video list failed');
  }
  return json.data?.videos ?? [];
}
