import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * accounts_memberships has composite PK (user_id, account_id) — no `id` column.
 */
export async function userIsAccountMember(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const { data: membership, error } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[membership]', error.message);
    return false;
  }

  return !!membership;
}
