import 'server-only';

import { getOptionalMetaInstagram } from '~/lib/instagram-autoreply/env';

const IG_VERSION = 'v21.0';

/** Instagram Business Login scopes for comments + private replies. */
export function buildInstagramAutoreplyAuthUrl(state: string): string {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');
  const scope = [
    'instagram_business_basic',
    'instagram_business_manage_comments',
    'instagram_business_manage_messages',
  ].join(',');
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    scope,
    state,
    response_type: 'code',
    force_reauth: 'true',
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

/**
 * Exchange authorization code for a short-lived Instagram User access token.
 * POST https://api.instagram.com/oauth/access_token
 */
export async function exchangeInstagramAutoreplyCode(code: string): Promise<{
  accessToken: string;
  userId: string | null;
  expiresIn: number;
}> {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');

  const body = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: cfg.redirectUri,
    code,
  });

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    user_id?: string | number;
    expires_in?: number;
    error_message?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error?.message ??
        data.error_message ??
        'Instagram token exchange failed',
    );
  }

  return {
    accessToken: data.access_token,
    userId: data.user_id != null ? String(data.user_id) : null,
    expiresIn: data.expires_in ?? 3600,
  };
}

/**
 * Exchange short-lived token for a 60-day long-lived Instagram User token.
 * GET https://graph.instagram.com/access_token
 */
export async function exchangeLongLivedInstagramAutoreply(
  shortLived: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const cfg = getOptionalMetaInstagram();
  if (!cfg) throw new Error('Instagram / Meta app is not configured');

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', cfg.appSecret);
  url.searchParams.set('access_token', shortLived);

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

/**
 * Refresh a long-lived Instagram User token (must be ≥24h old, not expired).
 * GET https://graph.instagram.com/refresh_access_token
 */
export async function refreshInstagramAutoreplyToken(
  accessToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
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

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

/**
 * Resolve the connected Instagram professional account for an IG User token.
 * GET https://graph.instagram.com/me
 */
export async function fetchInstagramAutoreplyBusinessAccount(
  userAccessToken: string,
  fallbackUserId?: string | null,
): Promise<{
  igUserId: string;
  username: string | null;
}> {
  const url = new URL(`https://graph.instagram.com/${IG_VERSION}/me`);
  url.searchParams.set('fields', 'user_id,username,account_type,name');
  url.searchParams.set('access_token', userAccessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    id?: string;
    user_id?: string;
    username?: string;
    error?: { message: string };
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message ?? 'Failed to load Instagram professional account',
    );
  }

  // Prefer user_id (IG professional account) when present; id is the /me node id.
  const igUserId = data.user_id ?? data.id ?? fallbackUserId;
  if (!igUserId) {
    throw new Error('Instagram account ID missing from token exchange');
  }

  return {
    igUserId: String(igUserId),
    username: data.username ?? null,
  };
}
