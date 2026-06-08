import type { SupabaseClient } from '@supabase/supabase-js';

import { jsonErr } from '~/lib/rankly/api-response';

export async function assertAccountMember(
  client: SupabaseClient,
  accountId: string,
  userId: string,
) {
  const { data, error } = await client
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return jsonErr('DB_ERROR', error.message, 500);
  }

  if (!data) {
    return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
  }
  return null;
}

export async function assertAccountAdmin(
  client: SupabaseClient,
  accountId: string,
  userId: string,
) {
  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return jsonErr('DB_ERROR', error.message, 500);
  }

  const role = data?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    return jsonErr('FORBIDDEN', 'Account admin required', 403);
  }
  return null;
}
