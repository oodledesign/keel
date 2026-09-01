export const NATIVE_WORKSPACE_PROFILES = [
  'personal',
  'family',
  'work_design',
  'community',
  'commercial_property',
  'building_surveyor',
] as const;

export type NativeWorkspaceProfile = (typeof NATIVE_WORKSPACE_PROFILES)[number];

export type NativeWorkspace = {
  id: string;
  slug: string;
  name: string;
  profile: NativeWorkspaceProfile;
  isPersonal: boolean;
  /** Public HTTPS logo or photo. Null when the account has no mark. */
  image: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function toNativeWorkspaceProfile(
  profile:
    | NativeWorkspaceProfile
    | 'work_property'
    | 'personal'
    | 'family'
    | 'community'
    | 'commercial_property'
    | 'building_surveyor'
    | 'work_design',
): NativeWorkspaceProfile {
  if (profile === 'personal' || profile === 'family') return profile;
  if (profile === 'community') return 'community';
  if (profile === 'commercial_property') return 'commercial_property';
  if (profile === 'building_surveyor') return 'building_surveyor';
  return 'work_design';
}

function findWorkspaceByAlias(
  workspaces: NativeWorkspace[],
  alias: string,
): NativeWorkspace | null {
  switch (alias) {
    case 'personal':
      return (
        workspaces.find((workspace) => workspace.isPersonal) ??
        workspaces.find((workspace) => workspace.profile === 'personal') ??
        null
      );
    case 'family':
      return (
        workspaces.find((workspace) => workspace.profile === 'family') ?? null
      );
    case 'business':
      return (
        workspaces.find((workspace) => workspace.profile === 'work_design') ??
        null
      );
    default:
      return null;
  }
}

export function findNativeWorkspace(
  workspaces: NativeWorkspace[],
  workspaceRef: string,
): NativeWorkspace | null {
  const ref = workspaceRef.trim();
  if (!ref) return null;

  const exact =
    workspaces.find((workspace) => workspace.slug === ref) ??
    (isUuid(ref)
      ? (workspaces.find((workspace) => workspace.id === ref) ?? null)
      : null);

  if (exact) {
    return exact;
  }

  return findWorkspaceByAlias(workspaces, ref.toLowerCase());
}

/** Keep only https:// URLs so native clients never follow http or relative paths. */
export function publicHttpsImageUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function publicNativeWorkspace(workspace: NativeWorkspace) {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    profile: workspace.profile,
    isPersonal: workspace.isPersonal,
    image: publicHttpsImageUrl(workspace.image),
  };
}
