import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { MEDIA_MODULE_KEY } from '~/lib/billing/media-unit-pricing';

export async function isMediaGenerateEnabled(
  accountId: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const db = client ?? getSupabaseServerAdminClient();
  const { data, error } = await db
    .from('account_module_settings')
    .select('enabled')
    .eq('account_id', accountId)
    .eq('module_key', MEDIA_MODULE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

export async function setMediaGenerateEnabled(params: {
  accountId: string;
  enabled: boolean;
}): Promise<void> {
  const admin = getSupabaseServerAdminClient();
  const { error } = await admin.from('account_module_settings').upsert(
    {
      account_id: params.accountId,
      module_key: MEDIA_MODULE_KEY,
      enabled: params.enabled,
    },
    { onConflict: 'account_id,module_key' },
  );

  if (error) {
    throw new Error(error.message);
  }
}
