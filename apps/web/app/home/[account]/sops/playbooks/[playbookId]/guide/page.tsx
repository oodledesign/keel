import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { SOP_WORKSPACE_SPACE_TYPES } from '~/lib/sops/workspace';

import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { SopPlaybookGuide } from '../../../_components/sop-playbook-guide';
import { loadSopPlaybookPage } from '../../../_lib/server/sops-data';

interface SopGuidePageProps {
  params: Promise<{ account: string; playbookId: string }>;
}

export const generateMetadata = async () => ({
  title: 'SOP guide',
});

async function SopPlaybookGuidePage({ params }: SopGuidePageProps) {
  const { account: accountSlug, playbookId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, SOP_WORKSPACE_SPACE_TYPES);

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
    redirect(getDefaultAccountPath(accountSlug));
  }

  const data = await loadSopPlaybookPage(accountSlug, playbookId);
  if (!data) notFound();

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={`${data.playbook.title} — guide`}
        description="Read-only reference for this process."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <SopPlaybookGuide
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          playbook={data.playbook}
          steps={data.steps}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SopPlaybookGuidePage);
