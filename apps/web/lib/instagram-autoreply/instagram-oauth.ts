import { getOptionalMetaInstagram } from '~/lib/instagram-autoreply/env';

const FB_VERSION = 'v21.0';

/** Extended scopes for comment replies and private replies. */
export function buildInstagramAutoreplyAuthUrl(state: string): string {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');
  const scope = [
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
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

export async function exchangeInstagramAutoreplyCode(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');
  const url = new URL(
    `https://graph.facebook.com/${FB_VERSION}/oauth/access_token`,
  );
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

export async function exchangeLongLivedInstagramAutoreply(
  shortLived: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');
  const url = new URL(
    `https://graph.facebook.com/${FB_VERSION}/oauth/access_token`,
  );
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
    throw new Error(
      data.error?.message ?? 'Instagram long-lived exchange failed',
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

export async function fetchInstagramAutoreplyBusinessAccount(
  userAccessToken: string,
): Promise<{
  igUserId: string;
  username: string | null;
  pageId: string;
  pageAccessToken: string;
}> {
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/me/accounts`);
  url.searchParams.set(
    'fields',
    'id,instagram_business_account{id,username},access_token',
  );
  url.searchParams.set('access_token', userAccessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
    error?: { message: string };
  };
  if (!res.ok || !data.data?.length) {
    throw new Error(
      data.error?.message ??
        'No Facebook pages / Instagram business account found',
    );
  }
  const page =
    data.data.find((p) => p.instagram_business_account?.id) ?? data.data[0];
  if (!page?.instagram_business_account?.id) {
    throw new Error(
      'Connect an Instagram Business or Creator account to a Facebook Page.',
    );
  }
  return {
    igUserId: page.instagram_business_account.id,
    username: page.instagram_business_account.username ?? null,
    pageId: page.id,
    pageAccessToken: page.access_token,
  };
}

export { refreshInstagramLongLived as refreshInstagramAutoreplyToken } from '~/lib/feedflow/instagram';
