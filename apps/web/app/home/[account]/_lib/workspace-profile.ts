import {
  COMMUNITY_WORKSPACE_MODULE_ORDER,
  FAMILY_WORKSPACE_MODULE_ORDER,
  PROPERTY_WORKSPACE_MODULE_ORDER,
  WORK_BUSINESS_MODULE_ORDER,
} from '~/config/workspace-module-order';

export type WorkspaceSpaceType = 'work' | 'family' | 'community' | 'property';

export function normalizeSpaceType(
  raw: string | null | undefined,
): WorkspaceSpaceType {
  if (raw === 'family') return 'family';
  if (raw === 'community') return 'community';
  if (raw === 'property') return 'property';
  return 'work';
}

/** Resolved workspace configuration (nav, dashboard, New menu). */
export type WorkspaceProfile =
  | 'work_design'
  | 'work_property'
  | 'family'
  | 'community';

export type BusinessType = 'design' | 'property' | 'other';

export function normalizeBusinessType(
  raw: string | null | undefined,
): BusinessType {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'property') return 'property';
  if (v === 'design') return 'design';
  return 'other';
}

/**
 * Derive workspace profile from account.space_type and optional businesses.type.
 * Legacy `accounts.space_type = 'property'` maps to work + property business.
 */
export function resolveWorkspaceProfile(input: {
  space_type?: string | null;
  business_type?: string | null;
}): WorkspaceProfile {
  const space = normalizeSpaceType(input.space_type);
  if (space === 'family') return 'family';
  if (space === 'community') return 'community';

  const biz = normalizeBusinessType(input.business_type);
  if (space === 'property' || biz === 'property') {
    return 'work_property';
  }

  return 'work_design';
}

/** Module keys to seed in account_module_settings (all enabled by default). */
export function moduleKeysForProfile(
  profile: WorkspaceProfile,
): readonly string[] {
  switch (profile) {
    case 'work_property':
      return PROPERTY_WORKSPACE_MODULE_ORDER;
    case 'family':
      return FAMILY_WORKSPACE_MODULE_ORDER;
    case 'community':
      return COMMUNITY_WORKSPACE_MODULE_ORDER;
    case 'work_design':
    default:
      return WORK_BUSINESS_MODULE_ORDER;
  }
}

export function getCanonicalModuleOrder(
  profile: WorkspaceProfile,
): readonly string[] {
  return moduleKeysForProfile(profile);
}

/** Human-readable type label for switcher / onboarding. */
export function workspaceTypeLabel(profile: WorkspaceProfile): string {
  switch (profile) {
    case 'work_property':
      return 'Property';
    case 'family':
      return 'Family';
    case 'community':
      return 'Community';
    case 'work_design':
    default:
      return 'Business';
  }
}

/** Map profile back to accounts.space_type for new workspaces. */
export function spaceTypeForProfile(
  profile: WorkspaceProfile,
): 'work' | 'family' | 'community' {
  if (profile === 'family') return 'family';
  if (profile === 'community') return 'community';
  return 'work';
}

export function businessTypeForProfile(
  profile: WorkspaceProfile,
): BusinessType | null {
  if (profile === 'work_property') return 'property';
  if (profile === 'work_design') return 'other';
  return null;
}

/** For route guards that still use WorkspaceSpaceType. */
export function spaceTypeFromProfile(
  profile: WorkspaceProfile,
): WorkspaceSpaceType {
  if (profile === 'work_property') return 'property';
  if (profile === 'family') return 'family';
  if (profile === 'community') return 'community';
  return 'work';
}

export function isBusinessProfile(profile: WorkspaceProfile): boolean {
  return profile === 'work_design' || profile === 'work_property';
}

export function isGroupProfile(profile: WorkspaceProfile): boolean {
  return profile === 'family' || profile === 'community';
}

/** Notes/Docs UI variant for shared workspace content components. */
export function notesVariantFromProfile(
  profile: WorkspaceProfile,
): 'work' | 'property' | 'family' | 'community' {
  if (profile === 'family') return 'family';
  if (profile === 'community') return 'community';
  if (profile === 'work_property') return 'property';
  return 'work';
}
