import 'server-only';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { decryptSecret } from '~/lib/feedflow/crypto-tokens';
import type { UnifiedPost } from '~/lib/feedflow/feed-types';
import { loadPersistedPosts } from '~/lib/feedflow/posts';
import { type TikTokVideo, fetchTikTokVideos } from '~/lib/feedflow/tiktok';

export type { UnifiedPost } from '~/lib/feedflow/feed-types';

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

async function readFeedCache(socialAccountId: string): Promise<{
  posts: UnifiedPost[];
  platform: 'instagram' | 'tiktok';
} | null> {
  const admin = createFeedflowAdminClient();
  const { data: cache } = await admin
    .from('feed_cache')
    .select('payload, raw_json')
    .eq('social_account_id', socialAccountId)
    .maybeSingle();

  const rawSource =
    (cache?.raw_json as Record<string, unknown> | null) ??
    (cache?.payload as Record<string, unknown> | null);

  if (!rawSource) return null;

  const raw = rawSource as { posts?: UnifiedPost[]; platform?: string };
  return {
    posts: raw.posts ?? [],
    platform: (raw.platform as 'instagram' | 'tiktok') ?? 'tiktok',
  };
}

/**
 * Public feed/embed path. Instagram reads persisted posts only — never hits Graph.
 * TikTok still uses the 1h cache and live refresh on miss.
 */
export async function getOrRefreshFeedForAccount(
  socialAccountId: string,
  postLimit: number,
): Promise<{ posts: UnifiedPost[]; platform: 'instagram' | 'tiktok' }> {
  const admin = createFeedflowAdminClient();
  const { data: account, error } = await admin
    .from('social_accounts')
    .select('id, account_id, platform, provider, access_token')
    .eq('id', socialAccountId)
    .single();
  if (error || !account) {
    throw new Error('Social account not found');
  }

  const kind = platformKind(account);

  if (kind === 'instagram') {
    const posts = await loadPersistedPosts(socialAccountId, postLimit);
    if (posts.length > 0) {
      return { posts, platform: 'instagram' };
    }

    const cached = await readFeedCache(socialAccountId);
    return {
      posts: (cached?.posts ?? []).slice(0, postLimit),
      platform: 'instagram',
    };
  }

  const cached = await readFeedCache(socialAccountId);
  const { data: cacheRow } = await admin
    .from('feed_cache')
    .select('id, expires_at')
    .eq('social_account_id', socialAccountId)
    .maybeSingle();

  const now = Date.now();
  const expiresAt = cacheRow?.expires_at
    ? new Date(cacheRow.expires_at as string).getTime()
    : 0;

  if (expiresAt > now && cached) {
    return cached;
  }

  const token = decryptSecret(account.access_token as string);
  const vids = await fetchTikTokVideos(token, postLimit);
  const posts = mapTikTok(vids);
  const payload = { posts, platform: kind };
  const accountId = account.account_id as string;

  if (cacheRow?.id) {
    await admin
      .from('feed_cache')
      .update({
        account_id: accountId,
        payload,
        raw_json: payload as unknown as Record<string, unknown>,
        cached_at: new Date().toISOString(),
        expires_at: new Date(now + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', cacheRow.id);
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
