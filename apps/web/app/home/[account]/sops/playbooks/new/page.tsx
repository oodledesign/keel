import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { SopNewPlaybookForm } from '../_components/sop-new-playbook-form';

interface SopNewPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'New SOP playbook',
});

async function SopNewPlaybookPage({ params }: SopNewPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'sops')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="New playbook"
        description="Import existing documentation or build steps manually."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <SopNewPlaybookForm accountId={accountId} accountSlug={accountSlug} />
      </PageBody>
    </>
  );
}

export default withI18n(SopNewPlaybookPage);
