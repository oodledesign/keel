import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { DocEditor } from '../_components/doc-editor';
import { loadDocDetailData } from '../_lib/server/docs-page.loader';

interface DocDetailPageProps {
  params: Promise<{ account: string; docId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Edit document',
});

async function DocDetailPage({ params }: DocDetailPageProps) {
  const { account: accountSlug, docId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'docs')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadDocDetailData(accountSlug, docId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title={data.doc.title || 'Untitled document'}
        description="Edit document"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <DocEditor
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          doc={data.doc}
        />
      </PageBody>
    </>
  );
}

export default withI18n(DocDetailPage);
