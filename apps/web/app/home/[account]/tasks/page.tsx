import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadTasksForTeamAccount } from '~/home/(user)/_lib/server/tasks.loader';
import { TasksPageClient } from '~/home/(user)/tasks/_components/tasks-page-client';

import { getDefaultAccountPath } from '../_lib/role-access';
import {
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
  getSpaceTypeFromAccount,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';

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
  const tasks = await loadTasksForTeamAccount(accountId);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
      <TasksPageClient
        initialTasks={tasks}
        variant="workspace"
        workspaceAccountId={accountId}
        workspaceAccountSlug={accountSlug}
      />
    </PageBody>
  );
}

export default withI18n(TeamAccountTasksPage);
