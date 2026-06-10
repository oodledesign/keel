import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadContractsPageData } from './_lib/server/contracts-page.loader';
import { ContractsPageContent } from './_components/contracts-page-content';

interface ContractsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = () => {
  return { title: 'Contracts' };
};

async function ContractsPage({ params }: ContractsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewInvoices ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'invoices')
  ) {
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

  const { accountId, canViewContracts, canEditContracts, canManageContractStatus } =
    await loadContractsPageData(accountSlug);

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
