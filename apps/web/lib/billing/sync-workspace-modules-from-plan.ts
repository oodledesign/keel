import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { BUSINESS_FREE_MODULE_KEYS } from '~/home/[account]/_lib/business-free-access';

import { syncAddonModulesFromEntitlements } from './sync-addon-modules-from-entitlements';

const BUSINESS_CORE_MODULE_KEYS = [
  'dashboard',
  'jobs',
  'tasks',
  'schedule',
  'pipeline',
  'forms',
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

const ADDON_MODULE_KEYS = [
  'feedflow',
  'rankly',
  'signatures',
  'videos',
  'site_studio',
] as const;

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

/** Restrict workspace to Business Free modules until Starter or Pro. */
export async function syncBusinessLiteModules(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  for (const moduleKey of BUSINESS_CORE_MODULE_KEYS) {
    if ((BUSINESS_FREE_MODULE_KEYS as readonly string[]).includes(moduleKey)) {
      continue;
    }
    await setModuleEnabled(admin, accountId, moduleKey, false);
  }

  for (const moduleKey of BUSINESS_FREE_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, true);
  }

  for (const moduleKey of ADDON_MODULE_KEYS) {
    await setModuleEnabled(admin, accountId, moduleKey, false);
  }

  await syncAddonModulesFromEntitlements(admin, accountId);
}
