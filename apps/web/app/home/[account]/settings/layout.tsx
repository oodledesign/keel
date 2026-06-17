import { redirect } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { WorkspaceSettingsSidebar } from './_components/workspace-settings-sidebar';
import { buildWorkspaceSettingsNav } from './_lib/workspace-settings-nav';

type WorkspaceSettingsLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

async function WorkspaceSettingsLayout({
  children,
  params,
}: WorkspaceSettingsLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(account, workspace.account));
  }

  const navItems = buildWorkspaceSettingsNav({
    accountSlug: account,
    workspaceProfile: workspace.workspaceProfile,
    moduleSettings: workspace.moduleSettings,
    access,
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={<Trans i18nKey={'teams:settings.pageTitle'} />}
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row lg:items-start lg:gap-10 lg:px-0">
          <WorkspaceSettingsSidebar accountSlug={account} items={navItems} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(WorkspaceSettingsLayout);
