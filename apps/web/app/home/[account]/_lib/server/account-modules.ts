import {
  normalizeSpaceType,
  resolveWorkspaceProfile,
  spaceTypeFromProfile,
  type WorkspaceSpaceType,
} from '../workspace-profile';

export type { WorkspaceSpaceType };
export { normalizeSpaceType };

export type AccountModuleKey =
  | 'dashboard'
  | 'jobs'
  | 'schedule'
  | 'tasks'
  | 'clients'
  | 'websites'
  | 'support_tickets'
  | 'invoices'
  | 'team'
  | 'pipeline'
  | 'notes'
  | 'docs'
  | 'sops'
  | 'messages'
  | 'finances'
  | 'feedflow'
  | 'rankly'
  | 'signatures'
  | 'videos'
  | 'properties'
  | 'calendar'
  | 'shopping'
  | 'meal_plan';

/** Nav label "Projects" maps to module_key `jobs` in account_module_settings. */
export function resolveAccountModuleKey(navKey: string): string {
  if (navKey === 'projects') return 'jobs';
  if (navKey === 'proposals' || navKey === 'contracts') return 'invoices';
  return navKey;
}

/** Property nav: Tenants → clients, Maintenance → jobs. */
export function resolvePropertyNavModuleKey(navKey: string): string {
  if (navKey === 'tenants') return 'clients';
  if (navKey === 'maintenance') return 'jobs';
  return navKey;
}

export function isWorkNavModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  navKey: string,
) {
  return isAccountModuleEnabled(moduleSettings, resolveAccountModuleKey(navKey));
}

export function isPropertyNavModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  navKey: string,
) {
  return isAccountModuleEnabled(
    moduleSettings,
    resolvePropertyNavModuleKey(navKey),
  );
}

/** Family nav: Members → team module_key in settings. */
export function resolveFamilyNavModuleKey(navKey: string): string {
  if (navKey === 'members') return 'team';
  return navKey;
}

export function isFamilyNavModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  navKey: string,
) {
  return isAccountModuleEnabled(
    moduleSettings,
    resolveFamilyNavModuleKey(navKey),
  );
}

/** Community nav: Members → team module_key in settings. */
export function resolveCommunityNavModuleKey(navKey: string): string {
  if (navKey === 'members') return 'team';
  return navKey;
}

export function isCommunityNavModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  navKey: string,
) {
  return isAccountModuleEnabled(
    moduleSettings,
    resolveCommunityNavModuleKey(navKey),
  );
}

export const FAMILY_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = ['family'];

export type AccountModuleSettingsMap = Partial<Record<AccountModuleKey, boolean>>;

export function getSpaceTypeFromAccount(
  account: {
    space_type?: string | null;
  },
  businessType?: string | null,
): WorkspaceSpaceType {
  return spaceTypeFromProfile(
    resolveWorkspaceProfile({
      space_type: account.space_type,
      business_type: businessType,
    }),
  );
}

/**
 * Per-account module toggles (`account_module_settings`, enabled=true only in loader).
 * When settings are loaded, keys absent from the map are treated as disabled.
 */
export function isAccountModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  key: string,
) {
  if (!moduleSettings) {
    return true;
  }

  if (Object.keys(moduleSettings).length === 0) {
    return true;
  }

  return moduleSettings[key] === true;
}

export function isWorkModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  key: AccountModuleKey,
) {
  return isAccountModuleEnabled(moduleSettings, key);
}

/** Feedflow module toggle (`account_module_settings.module_key = 'feedflow'`). */
export function isFeedflowModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
) {
  return isWorkModuleEnabled(moduleSettings, 'feedflow');
}

/** Rankly module toggle (`account_module_settings.module_key = 'rankly'`). */
export function isRanklyModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
) {
  return isWorkModuleEnabled(moduleSettings, 'rankly');
}

/** Signatures module toggle (`account_module_settings.module_key = 'signatures'`). */
export function isSignaturesModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
) {
  return isWorkModuleEnabled(moduleSettings, 'signatures');
}

/** Video hosting module toggle (`account_module_settings.module_key = 'videos'`). */
export function isVideosModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
) {
  return isWorkModuleEnabled(moduleSettings, 'videos');
}
