import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import { isContractsModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  CONTRACTS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';

export async function loadContractsPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, CONTRACTS_WORKSPACE_SPACE_TYPES);

  const account = workspace.account as {
    id: string;
    slug: string | null;
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(account);
  const invoicesModuleEnabled = isContractsModuleEnabled(
    workspace.moduleSettings,
    workspace.workspaceProfile,
  );

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    user: workspace.user,
    canViewContracts: access.canViewInvoices && invoicesModuleEnabled,
    canEditContracts: access.canEditInvoices && invoicesModuleEnabled,
    canManageContractStatus: access.isOwner || access.isAdmin,
  };
}
