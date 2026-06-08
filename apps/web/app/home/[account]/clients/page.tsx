import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadClientsPageData } from './_lib/server/clients-page.loader';
import { ClientsPageContent } from './_components/clients-page-content';

interface ClientsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string }>;
}) => {
  const workspace = await loadTeamWorkspace((await params).account);
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  return { title: spaceType === 'property' ? 'Tenants' : 'Clients' };
};

async function ClientsPage({ params }: ClientsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  const clientsEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'tenants')
      : isWorkModuleEnabled(workspace.moduleSettings, 'clients');

  if (!access.canViewClients || !clientsEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const {
    accountId,
    canViewClients,
    canEditClients,
    isContractorView,
    initialClients,
    initialTotal,
  } = await loadClientsPageData(accountSlug);

  const isProperty = spaceType === 'property';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={isProperty ? 'Tenants' : 'Clients'}
        description={
          isProperty
            ? 'Active tenancies and contacts'
            : 'Manage your clients'
        }
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <ClientsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewClients={canViewClients}
          canEditClients={canEditClients}
          isContractorView={isContractorView}
          initialClients={initialClients}
          initialTotal={initialTotal}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ClientsPage);
