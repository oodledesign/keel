import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { ClientImportPageClient } from '../_components/client-import-page-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const metadata = {
  title: 'Import clients',
};

async function ClientImportPage({ params }: PageProps) {
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

  if (!access.canEditClients || !clientsEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Import clients"
        description="Bulk import clients from a CSV file."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <ClientImportPageClient
          accountId={workspace.account.id as string}
          accountSlug={accountSlug}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ClientImportPage);
