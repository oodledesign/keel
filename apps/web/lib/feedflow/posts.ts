import 'server-only';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { decryptSecret } from '~/lib/feedflow/crypto-tokens';
import type { UnifiedPost } from '~/lib/feedflow/feed-types';
import {
  type IgMediaChild,
  type IgMediaItem,
  InstagramRateLimitedError,
  displayMediaForPost,
  fetchInstagramMedia,
  flattenMediaChildren,
} from '~/lib/feedflow/instagram';

export { type UnifiedPost } from '~/lib/feedflow/feed-types';

const MAX_POSTS = 30;

export type PersistedPostRow = {
  external_post_id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string | null;
  username: string | null;
  posted_at: string | null;
  children: IgMediaChild[] | null;
};

export function mapPersistedPosts(rows: PersistedPostRow[]): UnifiedPost[] {
  return rows.map((row) => {
    const display = displayMediaForPost({
      media_type: row.media_type,
      media_url: row.media_url,
      thumbnail_url: row.thumbnail_url,
      children: row.children,
    });

    return {
      id: row.external_post_id,
      media_url: display.src || row.media_url || row.thumbnail_url || '',
      thumbnail_url: row.thumbnail_url || display.src || row.media_url || '',
      caption: row.caption ?? '',
      permalink: row.permalink ?? '',
      timestamp: row.posted_at ?? '',
      media_type: row.media_type,
      username: row.username ?? null,
    };
  });
}

export function mapInstagramItems(items: IgMediaItem[]): UnifiedPost[] {
  return items.map((item) => {
    const children = flattenMediaChildren(item);
    const display = displayMediaForPost({
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url,
      children,
    });

    return {
      id: item.id,
      media_url: display.src || item.media_url || item.thumbnail_url || '',
      thumbnail_url: item.thumbnail_url || display.src || item.media_url || '',
      caption: item.caption ?? '',
      permalink: item.permalink ?? '',
      timestamp: item.timestamp ?? '',
      media_type: item.media_type ?? 'IMAGE',
      username: item.username ?? null,
    };
  });
}

export async function loadPersistedPosts(
  socialAccountId: string,
  postLimit: number,
): Promise<UnifiedPost[]> {
  const admin = createFeedflowAdminClient();
  const limit = Math.min(MAX_POSTS, Math.max(1, postLimit));

  const { data, error } = await admin
    .from('posts')
    .select(
      'external_post_id, media_type, media_url, thumbnail_url, permalink, caption, username, posted_at, children',
    )
    .eq('social_account_id', socialAccountId)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return mapPersistedPosts((data ?? []) as PersistedPostRow[]);
}

export async function deletePostsForSocialAccount(
  socialAccountId: string,
): Promise<void> {
  const admin = createFeedflowAdminClient();
  const { error } = await admin
    .from('posts')
    .delete()
    .eq('social_account_id', socialAccountId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function ingestInstagramAccount(socialAccountId: string): Promise<{
  stored: number;
  rateLimited: boolean;
}> {
  const admin = createFeedflowAdminClient();
  const { data: account, error } = await admin
    .from('social_accounts')
    .select(
      'id, account_id, access_token, platform, provider, platform_user_id, username',
    )
    .eq('id', socialAccountId)
    .single();

  if (error || !account) {
    throw new Error('Social account not found');
  }

  const kind = (account.platform ?? account.provider ?? '').toLowerCase();
  if (kind !== 'instagram') {
    return { stored: 0, rateLimited: false };
  }

  const igUserId = account.platform_user_id as string | null;
  const token = decryptSecret(account.access_token as string);
  if (!igUserId) {
    throw new Error('Instagram user id missing');
  }

  let items: IgMediaItem[];
  let rateLimited = false;
  try {
    const fetched = await fetchInstagramMedia(igUserId, token, MAX_POSTS);
    items = fetched.items;
    rateLimited = fetched.rateLimit.shouldPause;
  } catch (error) {
    if (error instanceof InstagramRateLimitedError) {
      return { stored: 0, rateLimited: true };
    }
    throw error;
  }

  const accountId = account.account_id as string;
  const now = new Date().toISOString();
  const keepIds = items.map((item) => item.id);

  const rows = items.map((item) => {
    const children = flattenMediaChildren(item);
    return {
      account_id: accountId,
      social_account_id: socialAccountId,
      provider: 'instagram',
      external_post_id: item.id,
      media_type: item.media_type ?? 'IMAGE',
      media_url: item.media_url ?? null,
      thumbnail_url: item.thumbnail_url ?? null,
      permalink: item.permalink ?? null,
      caption: item.caption ?? null,
      username: item.username ?? (account.username as string | null),
      posted_at: item.timestamp ?? null,
      children,
      raw_json: item as unknown as Record<string, unknown>,
      ingested_at: now,
    };
  });

  if (rows.length > 0) {
    const { error: upsertError } = await admin.from('posts').upsert(rows, {
      onConflict: 'social_account_id,external_post_id',
    });
    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  const keepSet = new Set(keepIds);
  const { data: existing } = await admin
    .from('posts')
    .select('external_post_id')
    .eq('social_account_id', socialAccountId);

  const staleIds = (existing ?? [])
    .map((row: { external_post_id: string }) => row.external_post_id)
    .filter((id: string) => !keepSet.has(id));

  if (staleIds.length > 0) {
    await admin
      .from('posts')
      .delete()
      .eq('social_account_id', socialAccountId)
      .in('external_post_id', staleIds);
  }

  const posts = mapInstagramItems(items);
  const payload = { posts, platform: 'instagram' as const };

  const { data: cache } = await admin
    .from('feed_cache')
    .select('id')
    .eq('social_account_id', socialAccountId)
    .maybeSingle();

  if (cache?.id) {
    await admin
      .from('feed_cache')
      .update({
        account_id: accountId,
        payload,
        raw_json: payload as unknown as Record<string, unknown>,
        cached_at: now,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', cache.id);
  } else {
    await admin.from('feed_cache').insert({
      social_account_id: socialAccountId,
      account_id: accountId,
      payload,
      raw_json: payload as unknown as Record<string, unknown>,
      cached_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return { stored: rows.length, rateLimited };
}
