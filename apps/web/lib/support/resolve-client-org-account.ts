import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/**
 * Resolve the workspace account id for a client_org.
 * `client_orgs` stores `business_id` only — historically either accounts.id
 * or businesses.id depending on when the org was created.
 *
 * Always uses the admin client for the businesses → account_id hop: portal
 * members cannot read `businesses` under RLS (owner-only), which previously
 * left a businesses UUID and made brand loading fall back to "Business".
 */
export async function resolveClientOrgAccountId(
  _client: SupabaseClient,
  org: { business_id?: string | null },
): Promise<string | null> {
  const businessId = org.business_id;
  if (!businessId) return null;

  const admin = getSupabaseServerAdminClient();

  const { data: business } = await admin
    .from('businesses')
    .select('account_id')
    .eq('id', businessId)
    .maybeSingle();

  const linkedAccountId = (
    business as { account_id?: string | null } | null
  )?.account_id?.trim();
  if (linkedAccountId) {
    return linkedAccountId;
  }

  // Legacy orgs may store accounts.id directly on business_id.
  const { data: account } = await admin
    .from('accounts')
    .select('id')
    .eq('id', businessId)
    .maybeSingle();

  if (account?.id) {
    return String(account.id);
  }

  return null;
}
