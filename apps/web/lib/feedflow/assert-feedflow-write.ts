import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

export async function assertFeedflowWriteAccess(
  accountId: string,
  userId: string,
): Promise<{
  client: SupabaseClient;
  slug: string;
}> {
  const client = getSupabaseServerClient() as SupabaseClient;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    throw new Error('Not a member of this account');
  }

  const { data: rows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (rows ?? []).map((row) => [row.module_key, row.enabled]),
  ) as Record<string, boolean>;

  if (!isWorkModuleEnabled(moduleSettings, 'feedflow')) {
    throw new Error('Feedflow is disabled for this account');
  }

  const { data: account, error } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !account?.slug) {
    throw new Error('Account not found');
  }

  return { client, slug: account.slug as string };
}
