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
import { LinkedInImportPageClient } from '../_components/linkedin-import-page-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const metadata = {
  title: 'Import from LinkedIn',
};

async function LinkedInImportPage({ params }: PageProps) {
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
  const pipelineEnabled = isWorkModuleEnabled(
    workspace.moduleSettings,
    'pipeline',
  );

  if (!clientsEnabled && !pipelineEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Import from LinkedIn"
        description="Export Connections.csv from LinkedIn, then import into clients or pipeline."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <LinkedInImportPageClient
          accountId={workspace.account.id as string}
          accountSlug={accountSlug}
          canImportClients={clientsEnabled && access.canEditClients}
          canImportPipeline={pipelineEnabled}
        />
      </PageBody>
    </>
  );
}

export default withI18n(LinkedInImportPage);
