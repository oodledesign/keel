export const WORKSPACE_IDS = [
  'personal',
  'work',
  'commercial-property',
] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export const WORKSPACE_OPTIONS: Array<{
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
}> = [
  {
    id: 'personal',
    label: 'Personal',
    shortLabel: 'Personal',
    description: 'Free hub — tasks, planner, and life across workspaces',
    href: '/personal',
  },
  {
    id: 'work',
    label: 'Business',
    shortLabel: 'Business',
    description: 'Clients, projects, invoices, and studio CRM',
    href: '/work',
  },
  {
    id: 'commercial-property',
    label: 'Commercial property',
    shortLabel: 'Property',
    description: 'Disposals, WIP, requirements, and agency portals',
    href: '/commercial-property',
  },
];

export function isWorkspaceId(value: string): value is WorkspaceId {
  return (WORKSPACE_IDS as readonly string[]).includes(value);
}

/** Detect the active workspace segment from a pathname like `/work/clients-pipeline`. */
export function workspaceFromPathname(pathname: string): WorkspaceId | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) {
    return null;
  }

  return isWorkspaceId(segment) ? segment : null;
}

/**
 * When switching workspace, keep a trailing path only if it is a shared leaf
 * (security-trust). Otherwise go to the target workspace home.
 */
export function pathForWorkspaceSwitch(
  currentPathname: string,
  target: WorkspaceId,
): string {
  const parts = currentPathname.split('/').filter(Boolean);
  const currentWorkspace = parts[0] && isWorkspaceId(parts[0]) ? parts[0] : null;
  const rest = currentWorkspace ? parts.slice(1) : parts;

  if (rest[0] === 'security-trust') {
    return `/${target}/security-trust`;
  }

  if (rest[0] === 'getting-started') {
    // Prefer workspace getting-started home when switching
    return `/${target}/getting-started`;
  }

  return `/${target}`;
}
