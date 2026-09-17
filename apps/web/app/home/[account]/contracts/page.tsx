import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isContractsModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  CONTRACTS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { ContractsPageContent } from './_components/contracts-page-content';
import { loadContractsPageData } from './_lib/server/contracts-page.loader';

interface ContractsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = () => {
  return { title: 'Contracts' };
};

async function ContractsPage({ params }: ContractsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, CONTRACTS_WORKSPACE_SPACE_TYPES);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const contractsEnabled = isContractsModuleEnabled(
    workspace.moduleSettings,
    workspace.workspaceProfile,
  );

  if (!access.canViewInvoices || !contractsEnabled) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const {
    accountId,
    canViewContracts,
    canEditContracts,
    canManageContractStatus,
  } = await loadContractsPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Contracts"
        description="Create and manage agreements"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <ContractsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewContracts={canViewContracts}
          canEditContracts={canEditContracts}
          canManageContractStatus={canManageContractStatus}
        />
      </PageBody>
    </>
  );
}

export default ContractsPage;
