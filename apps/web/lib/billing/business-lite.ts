import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export const BUSINESS_LITE_ENTITLEMENT = 'workspace_business_lite';

export async function hasBusinessLiteEntitlement(
  client: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('account_entitlements')
    .select('id')
    .eq('account_id', accountId)
    .eq('entitlement_key', BUSINESS_LITE_ENTITLEMENT)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (error) {
    console.error('[billing] hasBusinessLiteEntitlement:', error.message);
    return false;
  }

  return Boolean(data);
}

export async function clearBusinessLiteEntitlement(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  await admin
    .from('account_entitlements')
    .delete()
    .eq('account_id', accountId)
    .eq('entitlement_key', BUSINESS_LITE_ENTITLEMENT);
}

export async function markBusinessUpgradedFromLite(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  await clearBusinessLiteEntitlement(admin, accountId);

  await admin
    .from('businesses')
    .update({ type: 'other' })
    .eq('account_id', accountId)
    .eq('type', 'lite');
}
