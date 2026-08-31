import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
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
  searchParams: Promise<{ list?: string }>;
}

export async function generateMetadata({ params }: ClientsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  const title =
    spaceType === 'property'
      ? 'Tenants'
      : spaceType === 'commercial-property'
        ? 'Contacts'
        : 'Clients';
  return { title };
}

async function ClientsPage({ params, searchParams }: ClientsPageProps) {
  const accountSlug = (await params).account;
  const listParam = (await searchParams).list;
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
  } = await loadClientsPageData(accountSlug, {
    variant,
    audience: listParam === 'mailing' ? 'mailing_list' : 'all',
  });

  const pageTitle = isProperty
    ? 'Tenants'
    : isCommercial
      ? 'Contacts'
      : 'Clients';

  return (
    <>
      <TeamAccountLayoutPageHeader account={accountSlug} title={pageTitle} />
      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-3 pt-2 pb-3 md:px-4 md:pb-4">
        <ClientsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewClients={canViewClients}
          canEditClients={canEditClients}
          isContractorView={isContractorView}
          initialOverview={initialOverview}
          initialTotal={initialTotal}
          variant={variant}
          pageTitle={pageTitle}
          hidePageTitle
          addClientLabel={
            isProperty
              ? 'Add tenant'
              : isCommercial
                ? 'Add contact'
                : 'Add client'
          }
          showCommercialRole={isCommercial}
          showLinkedInImport={!isCommercial}
          initialAudience={listParam === 'mailing' ? 'mailing_list' : 'all'}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ClientsPage);
