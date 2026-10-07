import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export type FeedflowSocialAccountRow = {
  id: string;
  platform: string | null;
  provider: string;
  external_account_id: string;
  username: string | null;
  client_id: string | null;
  created_at: string;
  last_refreshed_at: string | null;
  token_status: string | null;
};

export type FeedflowWidgetRow = {
  id: string;
  name: string;
  embed_key: string;
  layout: string | null;
  post_count: number | null;
  created_at: string;
  social_account_id: string | null;
};

export type FeedflowVideoRow = {
  id: string;
  title: string | null;
  status: string;
  embed_key: string | null;
  created_at: string;
};

export const loadFeedflowSocialAccountsForTeam = cache(
  async (accountId: string): Promise<FeedflowSocialAccountRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'feedflow')
      .from('social_accounts')
      .select(
        'id, platform, provider, external_account_id, username, client_id, created_at, last_refreshed_at, token_status',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[feedflow] social_accounts', error.message);
      return [];
    }
    return (data ?? []) as FeedflowSocialAccountRow[];
  },
);

export const loadFeedflowWidgetsForTeam = cache(
  async (accountId: string): Promise<FeedflowWidgetRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'feedflow')
      .from('widgets')
      .select(
        'id, name, embed_key, layout, post_count, created_at, social_account_id',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[feedflow] widgets', error.message);
      return [];
    }
    return (data ?? []) as FeedflowWidgetRow[];
  },
);

export const loadClientForTeam = cache(
  async (clientId: string, accountId: string) => {
    const client = getSupabaseServerClient() as SupabaseClient;
    const { data, error } = await client
      .from('clients')
      .select('id, display_name')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[feedflow] clients', error.message);
      return null;
    }
    return data as { id: string; display_name: string } | null;
  },
);

export const loadFeedflowSocialAccountsForClient = cache(
  async (clientId: string, accountId: string) => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'feedflow')
      .from('social_accounts')
      .select(
        'id, platform, provider, external_account_id, username, created_at, last_refreshed_at, token_status',
      )
      .eq('account_id', accountId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[feedflow] social_accounts for client', error.message);
      return [];
    }
    return (data ?? []) as FeedflowSocialAccountRow[];
  },
);

export const loadFeedflowVideosForTeam = cache(
  async (accountId: string): Promise<FeedflowVideoRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'feedflow')
      .from('videos')
      .select('id, title, status, embed_key, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[feedflow] videos', error.message);
      return [];
    }
    return (data ?? []) as FeedflowVideoRow[];
  },
);

export type FeedflowReviewRow = {
  id: string;
  source: 'google' | 'manual' | 'csv';
  reviewer_name: string;
  rating: number;
  comment: string | null;
  reviewed_at: string | null;
  hidden: boolean;
};

export type FeedflowWebflowConnectionRow = {
  id: string;
  site_name: string | null;
  collection_name: string | null;
  webflow_collection_id: string | null;
  field_mapping: Record<string, string> | null;
  sync_mode: string | null;
  auto_publish: boolean | null;
  min_rating: number | null;
  min_character_count: number | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
};

export type FeedflowWebflowSyncLogRow = {
  id: string;
  reviews_fetched: number | null;
  reviews_synced: number | null;
  reviews_skipped: number | null;
  success: boolean | null;
  error_message: string | null;
  synced_at: string;
};

/** Reviews for the workspace (clientId null) or one CRM client. */
export async function loadFeedflowReviews(
  accountId: string,
  clientId: string | null,
): Promise<FeedflowReviewRow[]> {
  const client = getSupabaseServerClient();
  let query = supabaseCustomSchema(client, 'feedflow')
    .from('reviews')
    .select('id, source, reviewer_name, rating, comment, reviewed_at, hidden')
    .eq('account_id', accountId)
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(200);
  query = clientId ? query.eq('client_id', clientId) : query.is('client_id', null);

  const { data, error } = await query;
  if (error) {
    console.error('[feedflow] reviews', error.message);
    return [];
  }
  return (data ?? []) as FeedflowReviewRow[];
}

/** The API token column is deliberately never selected here. */
export async function loadFeedflowWebflowConnection(
  accountId: string,
  clientId: string | null,
): Promise<{
  connection: FeedflowWebflowConnectionRow | null;
  log: FeedflowWebflowSyncLogRow[];
}> {
  const client = getSupabaseServerClient();
  const feed = supabaseCustomSchema(client, 'feedflow');

  let query = feed
    .from('webflow_connections')
    .select(
      'id, site_name, collection_name, webflow_collection_id, field_mapping, sync_mode, auto_publish, min_rating, min_character_count, last_synced_at, sync_status, sync_error',
    )
    .eq('account_id', accountId);
  query = clientId ? query.eq('client_id', clientId) : query.is('client_id', null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[feedflow] webflow_connections', error.message);
    return { connection: null, log: [] };
  }
  if (!data) return { connection: null, log: [] };

  const { data: log } = await feed
    .from('webflow_sync_log')
    .select(
      'id, reviews_fetched, reviews_synced, reviews_skipped, success, error_message, synced_at',
    )
    .eq('webflow_connection_id', data.id)
    .order('synced_at', { ascending: false })
    .limit(5);

  return {
    connection: data as FeedflowWebflowConnectionRow,
    log: (log ?? []) as FeedflowWebflowSyncLogRow[],
  };
}
