import { canAccessWorkspaceForms } from '~/lib/workspace-forms/forms-mode';

import {
  hasConfiguredModules,
  resolveAccountModuleKey,
} from './server/account-modules';

/** Modules Business Free (Lite) includes. */
export const BUSINESS_FREE_MODULE_KEYS = [
  'dashboard',
  'apps',
  'settings',
  'team',
  'clients',
  'tasks',
  'invoices',
  'client_portal',
  'notes',
  'pipeline',
  'messages',
] as const;

/** Paid Business modules that stay off on Free, whatever the stored toggle says. */
export const BUSINESS_FREE_EXCLUDED_MODULE_KEYS = [
  'jobs',
  'schedule',
  'forms',
  'websites',
  'support_tickets',
  'docs',
  'sops',
  'finances',
  'proposals',
  'contracts',
] as const;

/**
 * Paid features that hang off a module Free does include (retainers → clients,
 * proposals → invoices, brain → notes), plus paid-only settings pages.
 */
const BUSINESS_FREE_EXCLUDED_FEATURE_KEYS = new Set([
  'proposals',
  'contracts',
  'retainers',
  'brain',
  'knowledge',
  'planner',
  'activity',
  'services',
]);

const EXCLUDED_MODULES = new Set<string>(BUSINESS_FREE_EXCLUDED_MODULE_KEYS);

/** Client detail tabs for paid Business features. */
export const BUSINESS_FREE_HIDDEN_CLIENT_TABS: readonly string[] = [
  'projects',
  'websites',
  'finance',
  'retainer',
];

/**
 * Effective module toggles for a Free workspace. Stored rows can drift (old
 * plan syncs, the legacy areas page), so paid modules are forced off here.
 */
export function applyBusinessFreeModuleMask(
  moduleSettings: Record<string, boolean>,
): Record<string, boolean> {
  const masked: Record<string, boolean> = hasConfiguredModules(moduleSettings)
    ? { ...moduleSettings }
    : {
        ...moduleSettings,
        ...Object.fromEntries(
          BUSINESS_FREE_MODULE_KEYS.map((key) => [key, true]),
        ),
      };

  for (const key of BUSINESS_FREE_EXCLUDED_MODULE_KEYS) {
    masked[key] = false;
  }

  return masked;
}

/** True when a nav or settings feature is not part of Business Free. */
export function isBusinessFreeFeatureBlocked(
  featureKey: string,
  moduleSettings: Record<string, boolean> | null | undefined,
): boolean {
  if (BUSINESS_FREE_EXCLUDED_FEATURE_KEYS.has(featureKey)) {
    return true;
  }

  // Campaigns buyers keep mailing-list signup forms without the Forms module.
  if (featureKey === 'forms') {
    return !canAccessWorkspaceForms(moduleSettings);
  }

  return EXCLUDED_MODULES.has(resolveAccountModuleKey(featureKey));
}

/** Sidebar choices a Free workspace won't see until it upgrades. */
export function businessFreePaidOnlyNavKeys(
  navKeys: readonly string[],
): string[] {
  return navKeys.filter(
    (key) =>
      key === 'emails' ||
      key === 'forms' ||
      isBusinessFreeFeatureBlocked(key, null),
  );
}

/** Free when the type says so, or the only Business entitlement is the Free one. */
export function resolveBusinessFree(input: {
  businessTypeIsLite: boolean;
  entitlementKeys: readonly string[];
}): boolean {
  if (input.businessTypeIsLite) {
    return true;
  }

  const keys = new Set(input.entitlementKeys);

  return (
    keys.has('workspace_business_lite') &&
    !keys.has('workspace_business') &&
    !keys.has('workspace_business_starter')
  );
}
