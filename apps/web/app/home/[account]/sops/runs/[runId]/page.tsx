import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { SopRunChecklist } from '../../_components/sop-run-checklist';
import { loadSopRunPage } from '../../_lib/server/sops-data';

interface SopRunPageProps {
  params: Promise<{ account: string; runId: string }>;
}

export const generateMetadata = async () => ({
  title: 'SOP run',
});

async function SopRunPage({ params }: SopRunPageProps) {
  const { account: accountSlug, runId } = await params;
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

  const data = await loadSopRunPage(accountSlug, runId);
  if (!data) notFound();

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={data.run.title}
        description="Work through each step — progress is saved for the whole team."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <SopRunChecklist
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          run={data.run}
          playbook={data.playbook}
          steps={data.steps}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SopRunPage);
