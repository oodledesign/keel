import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { buildWorkAppLinks } from '~/config/work-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { isWorkNavModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { WorkspaceAppsGrid } from './_components/workspace-apps-grid';

interface WorkspaceAppsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Apps',
});

async function WorkspaceAppsPage({ params }: WorkspaceAppsPageProps) {
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

  const appsEnabled = isWorkNavModuleEnabled(workspace.moduleSettings, 'apps');
  const apps = buildWorkAppLinks(accountSlug, workspace.moduleSettings);

  if (!access.canViewDashboard || !appsEnabled || apps.length === 0) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Apps"
        description="Installed apps for this workspace."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="space-y-6 px-4 lg:px-0">
          <WorkspaceAppsGrid apps={apps} />
          <p className="text-muted-foreground text-xs">
            Need another app? Manage modules in{' '}
            <a
              href={pathsConfig.app.accountSettings.replace('[account]', accountSlug)}
              className="text-[var(--keel-teal)] hover:underline"
            >
              workspace settings
            </a>
            .
          </p>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(WorkspaceAppsPage);
