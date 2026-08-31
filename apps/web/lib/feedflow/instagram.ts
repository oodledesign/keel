import { getOptionalInstagram } from '~/lib/feedflow/env';

const IG_VERSION = 'v21.0';
const IG_GRAPH = `https://graph.instagram.com/${IG_VERSION}`;
const IG_SCOPE = 'instagram_business_basic';

export const INSTAGRAM_FEEDFLOW_SCOPE = IG_SCOPE;

type GraphErrorBody = {
  access_token?: string;
  user_id?: string | number;
  expires_in?: number;
  error_type?: string;
  error_message?: string;
  error?: { message?: string; type?: string; code?: number };
};

function graphErrorMessage(data: GraphErrorBody, fallback: string): string {
  return data.error?.message ?? data.error_message ?? fallback;
}

export function buildInstagramAuthUrl(state: string): string {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');

  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    scope: IG_SCOPE,
    state,
    response_type: 'code',
    force_reauth: 'true',
  });

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string;
  userId: string | null;
  expiresIn: number;
}> {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');

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

  const data = (await res.json()) as GraphErrorBody;

  if (!res.ok || !data.access_token) {
    throw new Error(graphErrorMessage(data, 'Instagram token exchange failed'));
  }

  return {
    accessToken: data.access_token,
    userId: data.user_id != null ? String(data.user_id) : null,
    expiresIn: data.expires_in ?? 3600,
  };
}

export async function exchangeLongLivedInstagram(shortLived: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const cfg = getOptionalInstagram();
  if (!cfg) throw new Error('Instagram is not configured');

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', cfg.appSecret);
  url.searchParams.set('access_token', shortLived);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GraphErrorBody;

  if (!res.ok || !data.access_token) {
    throw new Error(
      graphErrorMessage(data, 'Instagram long-lived exchange failed'),
    );
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

export async function refreshInstagramLongLived(accessToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GraphErrorBody;

  if (!res.ok || !data.access_token) {
    throw new Error(graphErrorMessage(data, 'Instagram token refresh failed'));
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

export async function fetchInstagramBusinessAccount(
  userAccessToken: string,
  fallbackUserId?: string | null,
): Promise<{
  igUserId: string;
  username: string | null;
}> {
  const url = new URL(`${IG_GRAPH}/me`);
  url.searchParams.set('fields', 'user_id,username,account_type,name');
  url.searchParams.set('access_token', userAccessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    id?: string;
    user_id?: string;
    username?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message ?? 'Failed to load Instagram professional account',
    );
  }

  const igUserId = data.user_id ?? data.id ?? fallbackUserId;
  if (!igUserId) {
    throw new Error('Instagram account ID missing from token exchange');
  }

  return {
    igUserId: String(igUserId),
    username: data.username ?? null,
  };
}

export type IgMediaChild = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
};

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: { data?: IgMediaChild[] };
};

export type InstagramRateLimit = {
  callCount: number | null;
  retryAfterSeconds: number | null;
  shouldPause: boolean;
};

const RATE_LIMIT_PAUSE_THRESHOLD = 80;

export function parseInstagramRateLimit(headers: Headers): InstagramRateLimit {
  const retryAfterRaw = headers.get('retry-after');
  const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : null;
  let callCount: number | null = null;

  const usage = headers.get('x-app-usage');
  if (usage) {
    try {
      const parsed = JSON.parse(usage) as { call_count?: number };
      if (typeof parsed.call_count === 'number') {
        callCount = parsed.call_count;
      }
    } catch {
      /* ignore malformed usage header */
    }
  }

  const shouldPause =
    (retryAfterSeconds != null &&
      Number.isFinite(retryAfterSeconds) &&
      retryAfterSeconds > 0) ||
    (callCount != null && callCount >= RATE_LIMIT_PAUSE_THRESHOLD);

  return { callCount, retryAfterSeconds, shouldPause };
}

export class InstagramRateLimitedError extends Error {
  readonly rateLimit: InstagramRateLimit;

  constructor(rateLimit: InstagramRateLimit, message = 'Instagram rate limited') {
    super(message);
    this.name = 'InstagramRateLimitedError';
    this.rateLimit = rateLimit;
  }
}

const MEDIA_FIELDS =
  'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{id,media_type,media_url,thumbnail_url,permalink}';

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<{ items: IgMediaItem[]; rateLimit: InstagramRateLimit }> {
  const url = new URL(`${IG_GRAPH}/${encodeURIComponent(igUserId)}/media`);
  url.searchParams.set('fields', MEDIA_FIELDS);
  url.searchParams.set('limit', String(Math.min(30, Math.max(1, limit))));
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const rateLimit = parseInstagramRateLimit(res.headers);
  const data = (await res.json()) as {
    data?: IgMediaItem[];
    error?: { message?: string };
  };

  if (!res.ok) {
    if (res.status === 429 || rateLimit.shouldPause) {
      throw new InstagramRateLimitedError(rateLimit);
    }
    throw new Error(data.error?.message ?? 'Instagram media fetch failed');
  }

  return { items: data.data ?? [], rateLimit };
}

export function flattenMediaChildren(item: IgMediaItem): IgMediaChild[] {
  return item.children?.data ?? [];
}

export function displayMediaForPost(item: {
  media_type: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  children?: IgMediaChild[] | { data?: IgMediaChild[] } | null;
}): { src: string; isVideo: boolean } {
  const children = Array.isArray(item.children)
    ? item.children
    : (item.children?.data ?? []);

  if (item.media_type === 'VIDEO') {
    return {
      src: item.thumbnail_url || item.media_url || '',
      isVideo: true,
    };
  }

  if (item.media_type === 'CAROUSEL_ALBUM') {
    const first = children[0];
    const src =
      first?.media_url ||
      first?.thumbnail_url ||
      item.media_url ||
      item.thumbnail_url ||
      '';
    return {
      src,
      isVideo: first?.media_type === 'VIDEO',
    };
  }

  return {
    src: item.media_url || item.thumbnail_url || '',
    isVideo: false,
  };
}
