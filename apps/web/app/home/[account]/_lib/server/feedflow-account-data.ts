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
        'id, platform, provider, external_account_id, client_id, created_at, last_refreshed_at, token_status',
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
        'id, platform, provider, external_account_id, created_at, last_refreshed_at, token_status',
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
