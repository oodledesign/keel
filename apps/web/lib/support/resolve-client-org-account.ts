import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve the workspace account id for a client_org.
 * `client_orgs` stores `business_id` only — historically either accounts.id
 * or businesses.id depending on when the org was created.
 */
export async function resolveClientOrgAccountId(
  client: SupabaseClient,
  org: { business_id?: string | null },
): Promise<string | null> {
  const businessId = org.business_id;
  if (!businessId) return null;

  const { data: business } = await client
    .from('businesses')
    .select('account_id')
    .eq('id', businessId)
    .maybeSingle();

  return (
    (business as { account_id?: string | null } | null)?.account_id ??
    businessId
  );
}
