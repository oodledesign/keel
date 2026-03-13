import { use } from 'react';

import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadClientsPageData } from './_lib/server/clients-page.loader';
import { ClientsPageContent } from './_components/clients-page-content';

interface ClientsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.clients');
  return { title };
};

async function ClientsPage({ params }: ClientsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewClients) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const { accountId, canViewClients, canEditClients, isContractorView } =
    await loadClientsPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.clients" />}
        description="Manage your clients"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <ClientsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewClients={canViewClients}
          canEditClients={canEditClients}
          isContractorView={isContractorView}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ClientsPage);
