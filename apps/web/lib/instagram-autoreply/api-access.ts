import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isInstagramAutoreplyModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

export type IgApiAccessResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

/**
 * Route-handler variant of assertInstagramAutoreplyAccess: returns a status
 * instead of redirecting. Requires settings.manage for write operations.
 */
export async function checkIgApiAccess(
  client: SupabaseClient,
  params: { accountId: string; userId: string; requireManage: boolean },
): Promise<IgApiAccessResult> {
  const { data: moduleRows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', params.accountId);

  const settings = Object.fromEntries(
    (moduleRows ?? []).map((row: { module_key: string; enabled: boolean }) => [
      row.module_key,
      row.enabled,
    ]),
  );

  if (!isInstagramAutoreplyModuleEnabled(settings)) {
    return {
      ok: false,
      status: 404,
      error: 'Instagram automation is not enabled',
    };
  }

  if (params.requireManage) {
    const { data: allowed } = await client.rpc('has_permission', {
      user_id: params.userId,
      account_id: params.accountId,
      permission_name: 'settings.manage',
    });
    if (!allowed) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
  } else {
    const { data: isMember } = await client.rpc('has_role_on_account', {
      account_id: params.accountId,
    });
    if (!isMember) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
  }

  return { ok: true };
}
