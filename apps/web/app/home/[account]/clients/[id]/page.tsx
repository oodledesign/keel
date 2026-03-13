import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { getTeamAccountAccess } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { loadClientsPageData } from '../_lib/server/clients-page.loader';
import { getClient } from '../_lib/server/server-actions';
import { ClientDetailPageContent } from '../_components/client-detail-page-content';
import { ClientDetailPageNav } from '../_components/client-detail-page-nav';

type Props = {
  params: Promise<{ account: string; id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { account: accountSlug, id: clientId } = await params;

  const workspace = await loadTeamWorkspace(accountSlug);
  if (!workspace?.account) notFound();

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );
  if (!access.canViewClients) {
    notFound();
  }

  const { accountId, canEditClients, isContractorView } =
    await loadClientsPageData(accountSlug);

  let client: unknown;
  try {
    client = await getClient({ accountId, clientId });
  } catch {
    notFound();
  }
  if (!client) notFound();

  const clientsListHref = pathsConfig.app.accountClients.replace(
    '[account]',
    accountSlug,
  );

  return (
    <PageBody className="flex flex-col bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
      <ClientDetailPageNav
        accountSlug={accountSlug}
        clientsListHref={clientsListHref}
      />
      <div className="mt-4 max-w-3xl">
        <ClientDetailPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={clientId}
          canEditClients={canEditClients}
          isContractorView={isContractorView}
          clientsListHref={clientsListHref}
        />
      </div>
    </PageBody>
  );
}
