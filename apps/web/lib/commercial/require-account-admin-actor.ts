import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Permanent deletes in the commercial workspace are limited to owners and
 * admins. RLS also allows staff to delete, so this has to be enforced here.
 */
export async function requireAccountAdminActor(
  accountId: string,
  action: string,
) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const role = data?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error(`Only owners and admins can ${action}.`);
  }

  return user;
}
