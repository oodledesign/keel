import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isFamilyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';

const JOBS_PAGE_SPACE_TYPES = [
  ...BUSINESS_WORKSPACE_SPACE_TYPES,
  'family',
] as const;

export async function loadJobsPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, [...JOBS_PAGE_SPACE_TYPES]);

  const account = workspace.account as {
    id: string;
    slug: string | null;
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
    space_type?: string | null;
  };
  const spaceType = getSpaceTypeFromAccount(account);
  const access = getTeamAccountAccess(account);
  const jobsModuleEnabled =
    spaceType === 'family'
      ? isFamilyNavModuleEnabled(workspace.moduleSettings, 'projects')
      : isWorkModuleEnabled(workspace.moduleSettings, 'jobs');
  const canViewJobs = access.canViewProjects && jobsModuleEnabled;
  const canEditJobs = access.canCreateJob;
  const canDeleteJobs = access.isOwner || access.isAdmin;

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    user: workspace.user,
    canViewJobs,
    canEditJobs,
    canDeleteJobs,
    isContractorView: access.isContractor,
    spaceType,
  };
}
