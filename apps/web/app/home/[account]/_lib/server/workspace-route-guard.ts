import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import type { WorkspaceSpaceType } from './account-modules';
import { getSpaceTypeFromAccount } from './account-modules';
import type { TeamAccountWorkspace } from './team-account-workspace.loader';

export function redirectIfSpaceNotIn(
  workspace: TeamAccountWorkspace,
  accountSlug: string,
  allowed: WorkspaceSpaceType[],
) {
  const kind = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  if (!allowed.includes(kind)) {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }
}
