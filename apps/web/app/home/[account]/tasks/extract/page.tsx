import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadTaskAssignmentOptionsForWorkspace } from '~/home/(user)/_lib/actions/task-actions';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { ExtractWorkspaceTasksClient } from '../_components/extract-workspace-tasks-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: `${i18n.t('common:routes.tasks')} — AI extract`,
  };
};

async function WorkspaceTasksExtractPage({ params }: PageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'tasks')) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const assignmentOptions =
    await loadTaskAssignmentOptionsForWorkspace(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.tasks" />}
        description="Extract tasks from an email or transcript with AI, then review before adding."
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <ExtractWorkspaceTasksClient
          accountId={accountId}
          accountSlug={accountSlug}
          assignmentOptions={assignmentOptions}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WorkspaceTasksExtractPage);
