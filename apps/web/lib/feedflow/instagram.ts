import { getOptionalInstagram } from '~/lib/feedflow/env';

const FB_VERSION = 'v21.0';

export function buildInstagramAuthUrl(state: string): string {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');
  const scope = [
    'instagram_basic',
    'pages_show_list',
    'business_management',
  ].join(',');
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    scope,
    state,
    response_type: 'code',
  });
  return `https://www.facebook.com/${FB_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', cfg.appId);
  url.searchParams.set('client_secret', cfg.appSecret);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? 'Instagram token exchange failed');
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

export async function exchangeLongLivedInstagram(shortLived: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', cfg.appId);
  url.searchParams.set('client_secret', cfg.appSecret);
  url.searchParams.set('fb_exchange_token', shortLived);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? 'Instagram long-lived exchange failed');
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 60 * 24 * 3600 };
}

type IgPage = {
  id: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function fetchInstagramBusinessAccount(
  userAccessToken: string,
): Promise<{ igUserId: string; username: string | null; pageAccessToken: string }> {
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/me/accounts`);
  url.searchParams.set('fields', 'instagram_business_account{id,username},access_token');
  url.searchParams.set('access_token', userAccessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    data?: IgPage[];
    error?: { message: string };
  };
  if (!res.ok || !data.data?.length) {
    throw new Error(
      data.error?.message ?? 'No Facebook pages / Instagram business account found',
    );
  }
  const page =
    data.data.find((p) => p.instagram_business_account?.id) ?? data.data[0];
  if (!page) {
    throw new Error('No Facebook page data returned');
  }
  const ig = page.instagram_business_account;
  if (!ig?.id) {
    throw new Error(
      'Connect an Instagram Business or Creator account to a Facebook Page.',
    );
  }
  return {
    igUserId: ig.id,
    username: ig.username ?? null,
    pageAccessToken: page.access_token,
  };
}

export async function refreshInstagramLongLived(accessToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL(`https://graph.instagram.com/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? 'Instagram token refresh failed');
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 60 * 24 * 3600 };
}

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<IgMediaItem[]> {
  const fields =
    'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/${igUserId}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    data?: IgMediaItem[];
    error?: { message: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Instagram media fetch failed');
  }
  return data.data ?? [];
}
