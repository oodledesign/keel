import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';

const BUSINESS_CORE_MODULE_KEYS = [
  'dashboard',
  'jobs',
  'tasks',
  'schedule',
  'pipeline',
  'clients',
  'websites',
  'support_tickets',
  'client_portal',
  'invoices',
  'team',
  'notes',
  'docs',
  'sops',
  'messages',
  'finances',
  'settings',
] as const;

const BUSINESS_LITE_MODULE_KEYS = [
  'dashboard',
  'apps',
  'settings',
  'team',
] as const;

const ADDON_MODULE_KEYS = ['feedflow', 'rankly', 'signatures', 'videos'] as const;

async function setModuleEnabled(
  admin: SupabaseClient,
  accountId: string,
  moduleKey: string,
  enabled: boolean,
) {
  await admin.from('account_module_settings').upsert(
    {
      account_id: accountId,
      module_key: moduleKey,
      enabled,
    },
    { onConflict: 'account_id,module_key' },
  );
}

/** Enable full CRM modules after upgrading from Business Lite to a paid business plan. */
export async function syncFullBusinessModules(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  for (const moduleKey of BUSINESS_CORE_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, true);
  }

  for (const moduleKey of ADDON_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, false);
  }

  await setModuleEnabled(admin, accountId, 'apps', false);

  await syncAddonModulesFromEntitlements(admin, accountId);
}

/** Restrict workspace to the free apps shell (Business Lite). */
export async function syncBusinessLiteModules(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  for (const moduleKey of BUSINESS_CORE_MODULE_KEYS) {
    if (moduleKey === 'dashboard' || moduleKey === 'team' || moduleKey === 'settings') {
      continue;
    }
    await setModuleEnabled(admin, accountId, moduleKey, false);
  }

  for (const moduleKey of BUSINESS_LITE_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, true);
  }

  for (const moduleKey of ADDON_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, false);
  }

  await syncAddonModulesFromEntitlements(admin, accountId);
}
