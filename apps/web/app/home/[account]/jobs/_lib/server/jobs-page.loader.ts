import 'server-only';

import { redirect } from 'next/navigation';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import pathsConfig from '~/config/paths.config';

export async function loadJobsPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  const account = workspace.account as {
    id: string;
    slug: string | null;
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(account);
  const canViewJobs = access.canViewProjects;
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
  };
}
