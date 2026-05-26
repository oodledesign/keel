/**
 * Legacy union of all module keys (settings UI, migrations).
 * Prefer profile-specific orders below for nav rendering.
 */
export const WORKSPACE_MODULE_ORDER = [
  'dashboard',
  'projects',
  'tasks',
  'schedule',
  'pipeline',
  'clients',
  'invoices',
  'team',
  'notes',
  'docs',
  'finances',
  'properties',
  'tenants',
  'maintenance',
  'calendar',
  'shopping',
  'meal_plan',
  'members',
  'apps',
  'settings',
] as const;

export type WorkspaceModuleOrderKey = (typeof WORKSPACE_MODULE_ORDER)[number];

/** work/design or work/other — standard business workspace. */
export const WORK_BUSINESS_MODULE_ORDER = [
  'dashboard',
  'projects',
  'tasks',
  'schedule',
  'pipeline',
  'clients',
  'invoices',
  'team',
  'notes',
  'docs',
  'finances',
  'apps',
  'settings',
] as const;

export type WorkBusinessModuleOrderKey =
  (typeof WORK_BUSINESS_MODULE_ORDER)[number];

/** work/property — property management workspace. */
export const PROPERTY_WORKSPACE_MODULE_ORDER = [
  'dashboard',
  'properties',
  'tenants',
  'maintenance',
  'finances',
  'docs',
  'tasks',
  'notes',
  'team',
  'settings',
] as const;

export type PropertyWorkspaceModuleOrderKey =
  (typeof PROPERTY_WORKSPACE_MODULE_ORDER)[number];

/** Family workspace sidebar order (`account_module_settings`). */
export const FAMILY_WORKSPACE_MODULE_ORDER = [
  'dashboard',
  'tasks',
  'calendar',
  'meal_plan',
  'shopping',
  'notes',
  'members',
  'settings',
] as const;

export type FamilyWorkspaceModuleOrderKey =
  (typeof FAMILY_WORKSPACE_MODULE_ORDER)[number];

/** Community / homegroup sidebar order (`account_module_settings`). */
export const COMMUNITY_WORKSPACE_MODULE_ORDER = [
  'dashboard',
  'schedule',
  'tasks',
  'notes',
  'members',
  'settings',
] as const;

export type CommunityWorkspaceModuleOrderKey =
  (typeof COMMUNITY_WORKSPACE_MODULE_ORDER)[number];
