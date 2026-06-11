import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import type { WorkspaceSpaceType } from './account-modules';
import { spaceTypeFromProfile } from './workspace-profile';

/** Work + property business workspaces share clients, jobs, notes, docs, etc. */
export const BUSINESS_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'work',
  'property',
];

export const GROUP_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'family',
  'community',
];

/** Accounts that use the shared `notes` / `docs` tables. */
export const ACCOUNT_NOTES_SPACE_TYPES: WorkspaceSpaceType[] = [
  ...BUSINESS_WORKSPACE_SPACE_TYPES,
  ...GROUP_WORKSPACE_SPACE_TYPES,
];
import type { TeamAccountWorkspace } from './team-account-workspace.loader';

export function redirectIfSpaceNotIn(
  workspace: TeamAccountWorkspace,
  accountSlug: string,
  allowed: WorkspaceSpaceType[],
) {
  const kind = spaceTypeFromProfile(workspace.workspaceProfile);
  if (!allowed.includes(kind)) {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }
}
