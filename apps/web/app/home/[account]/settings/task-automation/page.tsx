import { redirect } from 'next/navigation';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { TaskAutomationSettingsForm } from '../_components/task-automation-settings-form';
import { loadTaskAutomationSettingsPageData } from '../_lib/server/task-automation-settings.loader';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: `${i18n.t('teams:settings.pageTitle')} — Task automation`,
  };
};

async function TaskAutomationSettingsPage({ params }: PageProps) {
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

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'tasks')) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadTaskAutomationSettingsPageData(accountSlug);
  const canEdit =
    !access.isClient && (access.isOwner || access.isAdmin || access.isStaff);

  return <TaskAutomationSettingsForm data={data} canEdit={canEdit} />;
}

export default withI18n(TaskAutomationSettingsPage);
