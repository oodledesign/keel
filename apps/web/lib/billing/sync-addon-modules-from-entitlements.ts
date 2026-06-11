import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveWorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import type { KeelAddonKey } from './keel-plan-catalog';

/** Maps paid add-on entitlements to `account_module_settings.module_key` values. */
const ADDON_ENTITLEMENT_MODULES: Record<KeelAddonKey, string[]> = {
  addon_signatures: ['signatures'],
  addon_rankly: ['rankly'],
  addon_feedflow: ['feedflow'],
  addon_videos: ['videos'],
};

function isEntitlementActive(row: {
  entitlement_key: string;
  expires_at: string | null;
}): boolean {
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Turn Rankly / Feedflow / Videos (and Apps when any add-on is active) on or off
 * based on `account_entitlements`. Business workspaces only.
 */
export async function syncAddonModulesFromEntitlements(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  const [{ data: account }, { data: business }, { data: entitlements }] =
    await Promise.all([
      admin
        .from('accounts')
        .select('space_type')
        .eq('id', accountId)
        .maybeSingle(),
      admin
        .from('businesses')
        .select('type')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from('account_entitlements')
        .select('entitlement_key, expires_at')
        .eq('account_id', accountId),
    ]);

  const profile = resolveWorkspaceProfile({
    space_type: (account as { space_type?: string | null } | null)?.space_type,
    business_type: (business as { type?: string | null } | null)?.type,
  });

  if (profile !== 'work_design') {
    return;
  }

  const activeKeys = new Set<string>();
  for (const row of entitlements ?? []) {
    if (isEntitlementActive(row as { entitlement_key: string; expires_at: string | null })) {
      activeKeys.add((row as { entitlement_key: string }).entitlement_key);
    }
  }

  let anyAddonActive = false;

  for (const [entitlementKey, moduleKeys] of Object.entries(
    ADDON_ENTITLEMENT_MODULES,
  ) as Array<[KeelAddonKey, string[]]>) {
    const enabled = activeKeys.has(entitlementKey);
    if (enabled) anyAddonActive = true;

    for (const moduleKey of moduleKeys) {
      await admin.from('account_module_settings').upsert(
        {
          account_id: accountId,
          module_key: moduleKey,
          enabled,
        },
        { onConflict: 'account_id,module_key' },
      );
    }
  }

  if (anyAddonActive) {
    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'apps',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );
  } else {
    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'apps',
        enabled: false,
      },
      { onConflict: 'account_id,module_key' },
    );
  }
}
