import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { ClientsPageContent } from './_components/clients-page-content';
import { loadClientsPageData } from './_lib/server/clients-page.loader';

interface ClientsPageProps {
  params: Promise<{ account: string }>;
}

export const metadata = {
  title: 'Clients',
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

  const isProperty = spaceType === 'property';
  const isCommercial = spaceType === 'commercial-property';
  const variant = isCommercial ? 'commercial' : 'work';

  const {
    accountId,
    canViewClients,
    canEditClients,
    isContractorView,
    initialOverview,
    initialTotal,
  } = await loadClientsPageData(accountSlug, { variant });

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-3 py-3 md:px-4 md:py-4">
      <ClientsPageContent
        accountSlug={accountSlug}
        accountId={accountId}
        canViewClients={canViewClients}
        canEditClients={canEditClients}
        isContractorView={isContractorView}
        initialOverview={initialOverview}
        initialTotal={initialTotal}
        variant={variant}
        pageTitle={
          isProperty ? 'Tenants' : isCommercial ? 'Contacts' : 'Clients'
        }
        addClientLabel={
          isProperty
            ? 'Add tenant'
            : isCommercial
              ? 'Add contact'
              : 'Add client'
        }
        showCommercialRole={isCommercial}
        showLinkedInImport={!isCommercial}
      />
    </PageBody>
  );
}

export default withI18n(ClientsPage);
