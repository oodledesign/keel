import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { SopPlaybookDetail } from '../../_components/sop-playbook-detail';
import { loadSopPlaybookPage } from '../../_lib/server/sops-data';

interface SopPlaybookPageProps {
  params: Promise<{ account: string; playbookId: string }>;
}

export const generateMetadata = async () => ({
  title: 'SOP playbook',
});

async function SopPlaybookPage({ params }: SopPlaybookPageProps) {
  const { account: accountSlug, playbookId } = await params;
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

  const data = await loadSopPlaybookPage(accountSlug, playbookId);
  if (!data) notFound();

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={data.playbook.title}
        description="Process template — start a run to work through the checklist."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <SopPlaybookDetail
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          playbook={data.playbook}
          steps={data.steps}
          runs={data.runs}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SopPlaybookPage);
