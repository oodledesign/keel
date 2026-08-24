import 'server-only';

import { redirect } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isInstagramAutoreplyModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

export async function assertInstagramAutoreplyAccess(
  accountId: string,
  userId: string,
) {
  const client = getSupabaseServerClient();

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    throw new Error('Forbidden');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  const slug = (account as { slug?: string } | null)?.slug;
  if (!slug) {
    throw new Error('Workspace not found');
  }

  const { data: moduleRows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (moduleRows ?? []).map((row) => [row.module_key, row.enabled]),
  );

  if (!isInstagramAutoreplyModuleEnabled(moduleSettings)) {
    redirect(pathsConfig.app.accountApps.replace('[account]', slug));
  }

  return { client, slug };
}

export async function loadIgConnectedAccount(
  client: SupabaseClient,
  accountId: string,
) {
  const { data, error } = await client
    .from('ig_connected_accounts')
    .select(
      'id, account_id, ig_business_account_id, ig_username, facebook_page_id, token_expires_at, voice_settings, is_active, created_at, updated_at',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function loadIgTriggers(client: SupabaseClient, accountId: string) {
  const { data, error } = await client
    .from('ig_triggers')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function loadIgCommentEvents(
  client: SupabaseClient,
  accountId: string,
  limit = 50,
) {
  const { data, error } = await client
    .from('ig_comment_events')
    .select(
      'id, comment_id, commenter_username, comment_text, public_reply_status, dm_status, public_reply_ai_credits_spent, dm_ai_credits_spent, pipeline_deal_id, error_message, created_at, matched_trigger_id',
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
