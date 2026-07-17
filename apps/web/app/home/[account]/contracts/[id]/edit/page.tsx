import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { ContractEditContent } from '../../_components/contract-edit-content';
import { loadContractsPageData } from '../../_lib/server/contracts-page.loader';
import { getContract } from '../../_lib/server/server-actions';

interface ContractEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  const { id } = await params;
  return { title: `Edit contract` };
};

async function ContractEditPage({ params }: ContractEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'invoices')) {
    notFound();
  }

  const {
    accountId,
    canViewContracts,
    canEditContracts,
    canManageContractStatus,
  } = await loadContractsPageData(accountSlug);

  if (!id) notFound();
  if (!canViewContracts) notFound();

  let contract: Awaited<ReturnType<typeof getContract>>;
  try {
    contract = await getContract({ accountId, contractId: id });
  } catch {
    notFound();
  }
  if (!contract) notFound();

  const title = (contract.title as string | null)?.trim() || 'Agreement';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={title}
        description={<AppBreadcrumbs values={{ [id]: title }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <ContractEditContent
          accountSlug={accountSlug}
          accountId={accountId}
          contract={contract as Record<string, unknown>}
          canEditContracts={canEditContracts}
          canManageContractStatus={canManageContractStatus}
        />
      </PageBody>
    </>
  );
}

export default ContractEditPage;
