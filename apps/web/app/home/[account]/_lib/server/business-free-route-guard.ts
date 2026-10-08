import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { isBusinessFreeFeatureBlocked } from '../business-free-access';
import { loadTeamWorkspace } from './team-account-workspace.loader';

/** Sends Business Free workspaces away from a paid-only section. */
export async function redirectIfBusinessFreeBlocked(
  accountSlug: string,
  featureKey: string,
  fallbackPath: string = pathsConfig.app.accountHome,
) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (
    workspace.businessLite &&
    isBusinessFreeFeatureBlocked(featureKey, workspace.moduleSettings)
  ) {
    redirect(fallbackPath.replace('[account]', accountSlug));
  }
}
