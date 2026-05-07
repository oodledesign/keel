import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { decryptSecret } from '~/lib/feedflow/crypto-tokens';
import { fetchInstagramMedia, type IgMediaItem } from '~/lib/feedflow/instagram';
import { fetchTikTokVideos, type TikTokVideo } from '~/lib/feedflow/tiktok';

export type UnifiedPost = {
  id: string;
  media_url: string;
  thumbnail_url: string;
  caption: string;
  permalink: string;
  timestamp: string;
  media_type: string;
  like_count?: number;
  view_count?: number;
};

function mapInstagram(items: IgMediaItem[]): UnifiedPost[] {
  return items.map((m) => ({
    id: m.id,
    media_url: m.media_url ?? m.thumbnail_url ?? '',
    thumbnail_url: m.thumbnail_url ?? m.media_url ?? '',
    caption: m.caption ?? '',
    permalink: m.permalink ?? '',
    timestamp: m.timestamp ?? '',
    media_type: m.media_type ?? 'IMAGE',
  }));
}

function mapTikTok(videos: TikTokVideo[]): UnifiedPost[] {
  return videos.map((v) => ({
    id: v.id,
    media_url: v.cover_image_url ?? '',
    thumbnail_url: v.cover_image_url ?? '',
    caption: v.title ?? '',
    permalink: v.share_url ?? '',
    timestamp: v.create_time
      ? new Date(v.create_time * 1000).toISOString()
      : '',
    media_type: 'VIDEO',
    like_count: v.like_count,
    view_count: v.view_count,
  }));
}

function platformKind(row: {
  platform?: string | null;
  provider?: string | null;
}): 'instagram' | 'tiktok' {
  const p = (row.platform ?? row.provider ?? '').toLowerCase();
  if (p === 'instagram') return 'instagram';
  return 'tiktok';
}

export async function getOrRefreshFeedForAccount(
  socialAccountId: string,
  postLimit: number,
): Promise<{ posts: UnifiedPost[]; platform: 'instagram' | 'tiktok' }> {
  const admin = createFeedflowAdminClient();
  const { data: account, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('id', socialAccountId)
    .single();
  if (error || !account) {
    throw new Error('Social account not found');
  }

  const { data: cache } = await admin
    .from('feed_cache')
    .select('*')
    .eq('social_account_id', socialAccountId)
    .maybeSingle();

  const now = Date.now();
  const expiresAt = cache?.expires_at
    ? new Date(cache.expires_at as string).getTime()
    : 0;
  const rawSource =
    (cache?.raw_json as Record<string, unknown> | null) ??
    (cache?.payload as Record<string, unknown> | null);
  if (expiresAt > now && rawSource) {
    const raw = rawSource as { posts?: UnifiedPost[]; platform?: string };
    return {
      posts: raw.posts ?? [],
      platform:
        (raw.platform as 'instagram' | 'tiktok') ?? platformKind(account),
    };
  }

  const token = decryptSecret(account.access_token as string);
  let posts: UnifiedPost[];

  const kind = platformKind(account);
  if (kind === 'instagram') {
    const igUserId = account.platform_user_id as string | null;
    if (!igUserId) throw new Error('Instagram user id missing');
    const media = await fetchInstagramMedia(igUserId, token, postLimit);
    posts = mapInstagram(media);
  } else {
    const vids = await fetchTikTokVideos(token, postLimit);
    posts = mapTikTok(vids);
  }

  const payload = {
    posts,
    platform: kind,
  };

  const accountId = account.account_id as string;

  if (cache?.id) {
    await admin
      .from('feed_cache')
      .update({
        account_id: accountId,
        payload,
        raw_json: payload as unknown as Record<string, unknown>,
        cached_at: new Date().toISOString(),
        expires_at: new Date(now + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', cache.id);
  } else {
    await admin.from('feed_cache').insert({
      social_account_id: socialAccountId,
      account_id: accountId,
      payload,
      raw_json: payload as unknown as Record<string, unknown>,
      expires_at: new Date(now + 60 * 60 * 1000).toISOString(),
    });
  }

  return { posts, platform: kind };
}
