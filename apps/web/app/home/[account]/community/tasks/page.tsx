import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadTasksForTeamAccount } from '~/home/(user)/_lib/server/tasks.loader';
import { TasksPageClient } from '~/home/(user)/tasks/_components/tasks-page-client';

import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { getSpaceTypeFromAccount } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';

interface CommunityTasksPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Tasks` };
};

async function CommunityTasksPage({ params }: CommunityTasksPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);

  // Validate space type — only family and community workspaces use this route
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );
  if (spaceType !== 'family' && spaceType !== 'community') {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const tasks = await loadTasksForTeamAccount(accountId);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
      <TasksPageClient
        initialTasks={tasks}
        variant="workspace"
        workspaceAccountId={accountId}
        workspaceAccountSlug={slug}
      />
    </PageBody>
  );
}

export default withI18n(CommunityTasksPage);
