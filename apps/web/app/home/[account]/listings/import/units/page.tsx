import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { UnitImportPageClient } from '../../_components/unit-import-page-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const metadata = {
  title: 'Import floor units',
};

async function UnitImportPage({ params }: PageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(
    workspace,
    accountSlug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Import floor units"
        description="Bulk import units from a Kato or Numbers CSV export."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <UnitImportPageClient
          accountId={workspace.account.id as string}
          accountSlug={accountSlug}
        />
      </PageBody>
    </>
  );
}

export default withI18n(UnitImportPage);
