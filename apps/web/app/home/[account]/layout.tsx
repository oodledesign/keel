import { use } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { TeamAccountWorkspaceContextProvider } from '@kit/team-accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamWorkspaceTopBarClient } from '~/components/workspace-shell/team-workspace-top-bar-client';

import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamWorkspaceMobileChrome } from './_components/team-workspace-mobile-chrome';
import { flattenTeamNavLinks } from './_lib/flatten-team-nav-links';
import { loadWorkspaceMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import pathsConfig from '~/config/paths.config';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import { getTeamAccountAccess } from './_lib/role-access';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';
import { buildWorkspaceShellMetadata } from '~/lib/seo/app-shell-metadata';
import { spaceTypeFromProfile } from './_lib/workspace-profile';
import { enforceWorkspaceBilling } from './_lib/server/workspace-billing-guard';
import { loadWorkspaceSwitcherAccounts } from '../_lib/server/workspace-switcher.loader';
import { loadWorkNavCounts } from './_lib/server/work-nav-counts.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  userRequiresWorkspaceSetup,
  workspaceSetupPath,
} from '~/lib/server/workspace-setup-guard';

type TeamWorkspaceLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export async function generateMetadata({ params }: TeamWorkspaceLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  const workspaceName =
    workspace.account.name?.trim() || account;

  return buildWorkspaceShellMetadata(workspaceName);
}

function TeamWorkspaceLayout({ children, params }: TeamWorkspaceLayoutProps) {
  const account = use(params).account;
  const state = use(getLayoutState(account));

  if (state.style === 'sidebar') {
    return <SidebarLayout account={account}>{children}</SidebarLayout>;
  }

  return <HeaderLayout account={account}>{children}</HeaderLayout>;
}

async function SidebarLayout({
  account,
  children,
}: React.PropsWithChildren<{
  account: string;
}>) {
  const user = await requireUserInServerComponent();
  if (await userRequiresWorkspaceSetup(user.id)) {
    redirect(workspaceSetupPath());
  }

  const client = (await import('@kit/supabase/server-client')).getSupabaseServerClient();

  const [data, state, switcherAccounts] = await Promise.all([
    loadTeamWorkspace(account),
    getLayoutState(account),
    loadWorkspaceSwitcherAccounts(client, user.id),
    enforceWorkspaceBilling(account),
  ]);

  if (!data) {
    redirect('/');
  }

  const accountId = data.account.id;

  const [navCounts, mobileNavShortcuts] = await Promise.all([
    loadWorkNavCounts(client, accountId, data.moduleSettings).catch((error) => {
      console.error('[team-workspace] loadWorkNavCounts:', error);
      return {} as WorkNavCounts;
    }),
    loadWorkspaceMobileNavShortcuts(client, user.id, accountId, account),
  ]);

  const workspaceProfile = data.workspaceProfile;
  const accounts =
    switcherAccounts.length > 0 ? switcherAccounts : [];

  const accountAccess = data.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const mobileNavLinks = flattenTeamNavLinks(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      data.moduleSettings,
      workspaceProfile,
      navCounts,
    ),
  );

  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    navLinks: mobileNavLinks,
    shortcuts: mobileNavShortcuts,
  });

  const access = getTeamAccountAccess(accountAccess);

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <SidebarProvider defaultOpen={state.open}>
        <Page
          style={'sidebar'}
          contentContainerClassName="mx-auto flex h-svh min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)]"
        >
          <PageNavigation>
            <TeamAccountLayoutSidebar
              account={account}
              accountId={data.account.id}
              accounts={accounts}
              user={data.user}
              moduleSettings={data.moduleSettings}
              workspaceProfile={workspaceProfile}
              navCounts={navCounts}
              accountAccess={accountAccess}
            />
          </PageNavigation>

          <PageMobileNavigation className="hidden lg:px-0" />

          <TeamWorkspaceMobileChrome
            account={account}
            accountId={data.account.id}
            user={data.user}
            accounts={accounts}
            navLinks={mobileNavLinks}
            bottomNavTabs={bottomNavTabs}
            spaceType={spaceTypeFromProfile(workspaceProfile)}
            showNewMenu={access.canUseQuickCreate}
          >
            <TeamWorkspaceTopBarClient accountSlug={account} />
            {children}
          </TeamWorkspaceMobileChrome>
        </Page>
      </SidebarProvider>
    </TeamAccountWorkspaceContextProvider>
  );
}

async function HeaderLayout({
  account,
  children,
}: React.PropsWithChildren<{
  account: string;
}>) {
  const user = await requireUserInServerComponent();
  if (await userRequiresWorkspaceSetup(user.id)) {
    redirect(workspaceSetupPath());
  }

  const client = (await import('@kit/supabase/server-client')).getSupabaseServerClient();
  const [data, switcherAccounts] = await Promise.all([
    loadTeamWorkspace(account),
    loadWorkspaceSwitcherAccounts(client, user.id),
    enforceWorkspaceBilling(account),
  ]);

  if (!data) {
    redirect('/');
  }

  const accountId = data.account.id;
  const workspaceProfile = data.workspaceProfile;
  const accounts = switcherAccounts;

  const [navCounts, mobileNavShortcuts] = await Promise.all([
    loadWorkNavCounts(client, accountId, data.moduleSettings).catch((error) => {
      console.error('[team-workspace] loadWorkNavCounts:', error);
      return {} as WorkNavCounts;
    }),
    loadWorkspaceMobileNavShortcuts(client, user.id, accountId, account),
  ]);

  const accountAccess = data.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const mobileNavLinks = flattenTeamNavLinks(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      data.moduleSettings,
      workspaceProfile,
      navCounts,
    ),
  );

  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    navLinks: mobileNavLinks,
    shortcuts: mobileNavShortcuts,
  });

  const access = getTeamAccountAccess(accountAccess);

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <Page style={'header'}>
        <PageNavigation>
          <TeamAccountNavigationMenu workspace={data} />
        </PageNavigation>

        <PageMobileNavigation className="hidden lg:px-0" />

        <TeamWorkspaceMobileChrome
          account={account}
          accountId={data.account.id}
          user={data.user}
          accounts={accounts}
          navLinks={mobileNavLinks}
          bottomNavTabs={bottomNavTabs}
          spaceType={spaceTypeFromProfile(workspaceProfile)}
          showNewMenu={access.canUseQuickCreate}
        >
          {children}
        </TeamWorkspaceMobileChrome>
      </Page>
    </TeamAccountWorkspaceContextProvider>
  );
}

async function getLayoutState(account: string) {
  const cookieStore = await cookies();
  const config = getTeamAccountSidebarConfig(account);

  const LayoutStyleSchema = z
    .enum(['sidebar', 'header', 'custom'])
    .default(config.style);

  const sidebarOpenCookie = cookieStore.get('sidebar:state');
  const layoutCookie = cookieStore.get('layout-style');

  const layoutStyle = LayoutStyleSchema.safeParse(layoutCookie?.value);

  const sidebarOpenCookieValue = sidebarOpenCookie
    ? sidebarOpenCookie.value === 'false'
    : !config.sidebarCollapsed;

  const style = layoutStyle.success ? layoutStyle.data : config.style;

  return {
    open: sidebarOpenCookieValue,
    style,
  };
}

export default withI18n(TeamWorkspaceLayout);
