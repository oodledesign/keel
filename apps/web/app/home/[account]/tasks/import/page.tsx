import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import {
  getSpaceTypeFromAccount,
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
} from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { TaskImportPageClient } from '../_components/task-import-page-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: `${i18n.t('common:routes.tasks')} — Import CSV`,
  };
};

async function WorkspaceTasksImportPage({ params }: PageProps) {
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

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.tasks" />}
        description="Import tasks from a CSV file."
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <TaskImportPageClient
          accountId={workspace.account.id as string}
          accountSlug={accountSlug}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WorkspaceTasksImportPage);
