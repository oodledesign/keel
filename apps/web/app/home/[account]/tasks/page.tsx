import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { loadTasksForTeamAccount } from '~/home/(user)/_lib/server/tasks.loader';
import { TasksPageClient } from '~/home/(user)/tasks/_components/tasks-page-client';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { loadPendingMeetingTaskReviewCount } from './review/_lib/server/meeting-review.loader';

interface TeamAccountTasksPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.tasks');
  return { title };
};

async function TeamAccountTasksPage({ params }: TeamAccountTasksPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  const tasksEnabled =
    spaceType === 'property'
      ? isPropertyNavModuleEnabled(workspace.moduleSettings, 'tasks')
      : isWorkModuleEnabled(workspace.moduleSettings, 'tasks');

  if (!tasksEnabled) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const [tasks, pendingReviewCount] = await Promise.all([
    loadTasksForTeamAccount(accountId),
    spaceType === 'work'
      ? loadPendingMeetingTaskReviewCount(accountId)
      : Promise.resolve(0),
  ]);

  const reviewHref =
    spaceType === 'work'
      ? pathsConfig.app.accountTasksReview.replace('[account]', accountSlug)
      : null;

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
      <TasksPageClient
        initialTasks={tasks}
        variant="workspace"
        workspaceAccountId={accountId}
        workspaceAccountSlug={accountSlug}
        reviewHref={reviewHref}
        pendingReviewCount={pendingReviewCount}
        currentUserId={(workspace.user as { id: string }).id}
      />
    </PageBody>
  );
}

export default withI18n(TeamAccountTasksPage);
