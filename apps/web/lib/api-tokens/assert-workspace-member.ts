import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';

export async function assertWorkspaceMember(
  client: SupabaseClient<Database>,
  accountId: string,
  userId: string,
) {
  const { data: membership, error } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!membership) {
    throw new Error('You are not a member of this workspace');
  }

  return membership;
}
