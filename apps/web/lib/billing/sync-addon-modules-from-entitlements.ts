import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveWorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import type { OzerAddonKey } from './ozer-plan-catalog';

/** Maps paid add-on entitlements to `account_module_settings.module_key` values. */
const ADDON_ENTITLEMENT_MODULES: Record<OzerAddonKey, string[]> = {
  addon_signatures: ['signatures'],
  addon_rankly: ['rankly'],
  addon_feedflow: ['feedflow'],
  addon_videos: ['videos'],
  // Dedicated Apps-nav module; Websites core module is enabled separately below.
  addon_site_studio: ['site_studio'],
};

function isEntitlementActive(row: {
  entitlement_key: string;
  expires_at: string | null;
}): boolean {
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Sync add-on modules from `account_entitlements` (work_design only).
 * Apps nav toggles for signatures/rankly/feedflow/videos; Site Studio is Websites-only.
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
    if (
      isEntitlementActive(
        row as { entitlement_key: string; expires_at: string | null },
      )
    ) {
      activeKeys.add((row as { entitlement_key: string }).entitlement_key);
    }
  }

  let anyAddonActive = false;

  /** Add-ons that should surface the Apps nav group (Site Studio is Websites-only). */
  const APPS_NAV_ADDON_KEYS = new Set<OzerAddonKey>([
    'addon_signatures',
    'addon_rankly',
    'addon_feedflow',
    'addon_videos',
  ]);

  for (const [entitlementKey, moduleKeys] of Object.entries(
    ADDON_ENTITLEMENT_MODULES,
  ) as Array<[OzerAddonKey, string[]]>) {
    const enabled = activeKeys.has(entitlementKey);
    if (enabled && APPS_NAV_ADDON_KEYS.has(entitlementKey)) {
      anyAddonActive = true;
    }

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

  // Site Studio needs the Websites route. Enable when entitled; never force-disable
  // websites here (full Business workspaces keep websites as a core module).
  if (activeKeys.has('addon_site_studio')) {
    await admin.from('account_module_settings').upsert(
      {
        account_id: accountId,
        module_key: 'websites',
        enabled: true,
      },
      { onConflict: 'account_id,module_key' },
    );
  }
}
