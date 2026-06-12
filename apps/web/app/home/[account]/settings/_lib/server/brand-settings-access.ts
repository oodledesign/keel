import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Matches brand settings UI (`canEditBrand = isOwner || isAdmin`), including
 * company admins whose membership row has no account_role yet.
 */
export async function assertCanEditBrandSettings(
  accountId: string,
  userId: string,
) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role, company_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const accountRole = membership?.account_role;
  const companyRole = membership?.company_role;

  const canEdit =
    accountRole === 'owner' ||
    accountRole === 'admin' ||
    (!accountRole && companyRole === 'admin');

  if (!canEdit) {
    throw new Error('Workspace owner or admin required');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { accountSlug: account.slug as string, client };
}
