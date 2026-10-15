import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canUseAddon } from '~/lib/billing/entitlements';

/**
 * Same gate as the Feedflow layout: workspace membership + addon access.
 * Super-admin and admin grants count via {@link canUseAddon}. Do not require
 * `account_module_settings.feedflow` — that row is often still off when Dan
 * tests via super-admin bypass, and the previous check bounced Connect to /app.
 */
export async function assertFeedflowWriteAccess(
  accountId: string,
  userId: string,
): Promise<{
  client: SupabaseClient;
  slug: string;
}> {
  const client = getSupabaseServerClient() as SupabaseClient;

  // Composite PK is (user_id, account_id) — there is no `id` column.
  const { data: membership, error: membershipError } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    console.error('[feedflow] membership check failed', membershipError.message);
    throw new Error('Not a member of this account');
  }
  if (!membership) {
    throw new Error('Not a member of this account');
  }

  const allowed = await canUseAddon(
    client,
    userId,
    accountId,
    'addon_feedflow',
  );
  if (!allowed) {
    throw new Error('Feedflow add-on required');
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
