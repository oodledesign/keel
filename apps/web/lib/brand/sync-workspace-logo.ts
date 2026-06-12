import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

/**
 * Keep workspace logo in sync across sidebar avatar, brand templates, and agency portal.
 */
export async function syncWorkspaceLogo(
  accountId: string,
  logoUrl: string | null,
) {
  const admin = getSupabaseServerAdminClient() as SupabaseClient;
  const normalized = logoUrl
    ? toSupabasePublicStorageUrl(logoUrl)
    : null;

  const { error: accountError } = await admin
    .from('accounts')
    .update({ picture_url: normalized })
    .eq('id', accountId);

  if (accountError) {
    throw new Error(accountError.message);
  }

  const { data: brandRow } = await admin
    .from('account_brand_settings')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (brandRow) {
    const { error: brandError } = await admin
      .from('account_brand_settings')
      .update({ logo_url: normalized })
      .eq('account_id', accountId);

    if (brandError) {
      throw new Error(brandError.message);
    }
  } else if (normalized) {
    const { error: brandInsertError } = await admin
      .from('account_brand_settings')
      .insert({ account_id: accountId, logo_url: normalized });

    if (brandInsertError) {
      throw new Error(brandInsertError.message);
    }
  }

  await admin
    .from('agency_branding')
    .update({ logo_url: normalized })
    .eq('business_id', accountId);

  return normalized;
}
