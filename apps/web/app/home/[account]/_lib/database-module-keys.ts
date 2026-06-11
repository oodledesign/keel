import type { WorkspaceProfile } from './workspace-profile';

/**
 * Keys stored in `account_module_settings` (not always equal to nav labels).
 * Keep aligned with `public.seed_account_module_settings`.
 */
export function databaseModuleKeysForProfile(
  profile: WorkspaceProfile,
): readonly string[] {
  switch (profile) {
    case 'work_property':
      return [
        'dashboard',
        'properties',
        'clients',
        'jobs',
        'finances',
        'docs',
        'tasks',
        'notes',
        'team',
        'settings',
      ];
    case 'family':
      return [
        'dashboard',
        'tasks',
        'calendar',
        'meal_plan',
        'shopping',
        'notes',
        'team',
        'settings',
      ];
    case 'community':
      return [
        'dashboard',
        'schedule',
        'tasks',
        'notes',
        'team',
        'settings',
      ];
    case 'work_design':
    default:
      return [
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
        'apps',
        'settings',
      ];
  }
}

export function databaseModuleKeysForBusinessLite(): readonly string[] {
  return ['dashboard', 'apps', 'settings', 'team'];
}
