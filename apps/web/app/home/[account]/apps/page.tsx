import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { buildWorkAppLinks } from '~/config/work-account-navigation.config';
import { syncAddonModulesFromEntitlements } from '~/lib/billing/sync-addon-modules-from-entitlements';
import { loadWorkspaceAddonState } from '~/lib/billing/workspace-addon-state.loader';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import {
  isSiteStudioModuleEnabled,
  isWorkNavModuleEnabled,
} from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { OzerAppsMarketplace } from './_components/ozer-apps-marketplace';

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

  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const addonState = await loadWorkspaceAddonState(
    client,
    user.id,
    workspace.account.id as string,
    workspace.workspaceProfile,
  );

  // Self-heal: entitlement may exist before site_studio/websites modules were wired.
  let moduleSettings = workspace.moduleSettings;
  if (
    addonState.addons.addon_site_studio &&
    (!isSiteStudioModuleEnabled(moduleSettings) ||
      !isWorkNavModuleEnabled(moduleSettings, 'websites'))
  ) {
    await syncAddonModulesFromEntitlements(
      getSupabaseServerAdminClient(),
      workspace.account.id as string,
    );
    const refreshed = await loadTeamWorkspace(accountSlug);
    moduleSettings = refreshed.moduleSettings;
  }

  const apps = buildWorkAppLinks(accountSlug, moduleSettings);
  const appsEnabled = isWorkNavModuleEnabled(moduleSettings, 'apps');

  if (!access.canViewDashboard || !appsEnabled) {
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
          <OzerAppsMarketplace
            accountSlug={accountSlug}
            installedApps={apps}
            workspacePaid={addonState.workspacePaid}
            activeAddons={addonState.addons}
          />
          <p className="text-muted-foreground text-xs">
            Need another app? Manage modules in{' '}
            <a
              href={pathsConfig.app.accountSettings.replace(
                '[account]',
                accountSlug,
              )}
              className="text-[var(--ozer-accent)] hover:underline"
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
