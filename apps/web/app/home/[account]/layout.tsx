import { use } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { TeamAccountWorkspaceContextProvider } from '@kit/team-accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { TeamWorkspaceTopBarClient } from '~/components/workspace-shell/team-workspace-top-bar-client';
import { WorkspaceFocusProviderShell } from '~/components/workspace-shell/workspace-focus-provider-shell';
import pathsConfig from '~/config/paths.config';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { buildWorkspaceShellMetadata } from '~/lib/seo/app-shell-metadata';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  userRequiresWorkspaceSetup,
  workspaceSetupPath,
} from '~/lib/server/workspace-setup-guard';
import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

import { loadWorkspaceSwitcherAccounts } from '../_lib/server/workspace-switcher.loader';
import { BillingAccessBannerHost } from './_components/billing-access-banner-host';
import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import { TeamWorkspaceMobileChrome } from './_components/team-workspace-mobile-chrome';
import { flattenTeamNavLinks } from './_lib/flatten-team-nav-links';
import { getTeamAccountAccess } from './_lib/role-access';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';
import { loadTeamWorkspaceShellAdornments } from './_lib/server/team-workspace-shell-adornments.loader';
import { enforceWorkspaceBilling } from './_lib/server/workspace-billing-guard';
import { spaceTypeFromProfile } from './_lib/workspace-profile';

type TeamWorkspaceLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

type LayoutState = {
  open: boolean;
  style: 'sidebar' | 'header' | 'custom';
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: TeamWorkspaceLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  const workspaceName = workspace.account.name?.trim() || account;

  return buildWorkspaceShellMetadata(workspaceName);
}

function TeamWorkspaceLayout({ children, params }: TeamWorkspaceLayoutProps) {
  const account = use(params).account;
  const state = use(getLayoutState(account));

  if (state.style === 'sidebar') {
    return (
      <SidebarLayout account={account} layoutState={state}>
        {children}
      </SidebarLayout>
    );
  }

  return (
    <HeaderLayout account={account} layoutState={state}>
      {children}
    </HeaderLayout>
  );
}

async function SidebarLayout({
  account,
  layoutState,
  children,
}: React.PropsWithChildren<{
  account: string;
  layoutState: LayoutState;
}>) {
  const user = await requireUserInServerComponent();
  if (await userRequiresWorkspaceSetup(user.id)) {
    redirect(workspaceSetupPath());
  }

  const client = (
    await import('@kit/supabase/server-client')
  ).getSupabaseServerClient();

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
  const accounts = switcherAccounts.length > 0 ? switcherAccounts : [];
  const focusAccountIds = [
    ...new Set([accountId, ...accounts.map((row) => row.id)]),
  ];

  const accountAccess = data.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const access = getTeamAccountAccess(accountAccess);
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const adornments = await loadTeamWorkspaceShellAdornments({
    client,
    userId: user.id,
    accountId,
    accountSlug: account,
    moduleSettings: data.moduleSettings,
    focusAccountIds,
  });

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <TeamWorkspaceSidebarShell
        account={account}
        accountId={accountId}
        user={data.user}
        accounts={accounts}
        moduleSettings={data.moduleSettings}
        workspaceProfile={workspaceProfile}
        accountAccess={accountAccess}
        navCounts={adornments.navCounts}
        mobileNavShortcuts={adornments.mobileNavShortcuts}
        focusSettingsByAccountId={adornments.focusSettingsByAccountId}
        layoutState={layoutState}
        showNewMenu={access.canUseQuickCreate}
        homePath={homePath}
      >
        <TeamWorkspaceTopBarClient accountSlug={account} />
        <BillingAccessBannerHost
          accountId={accountId}
          accountSlug={account}
          canManageBilling={access.canManageBilling}
        />
        {children}
      </TeamWorkspaceSidebarShell>
    </TeamAccountWorkspaceContextProvider>
  );
}

function TeamWorkspaceSidebarShell({
  account,
  accountId,
  user,
  accounts,
  moduleSettings,
  workspaceProfile,
  accountAccess,
  navCounts,
  mobileNavShortcuts,
  focusSettingsByAccountId,
  layoutState,
  showNewMenu,
  homePath,
  children,
}: {
  account: string;
  accountId: string;
  user: React.ComponentProps<typeof TeamAccountLayoutSidebar>['user'];
  accounts: React.ComponentProps<typeof TeamAccountLayoutSidebar>['accounts'];
  moduleSettings: Record<string, boolean>;
  workspaceProfile: React.ComponentProps<
    typeof TeamAccountLayoutSidebar
  >['workspaceProfile'];
  accountAccess: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  navCounts: WorkNavCounts;
  mobileNavShortcuts: Awaited<
    ReturnType<typeof loadTeamWorkspaceShellAdornments>
  >['mobileNavShortcuts'];
  focusSettingsByAccountId: Record<string, WorkspaceFocusInput>;
  layoutState: LayoutState;
  showNewMenu: boolean;
  homePath: string;
  children: React.ReactNode;
}) {
  const mobileNavLinks = flattenTeamNavLinks(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      moduleSettings,
      workspaceProfile,
      navCounts,
    ),
  );

  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    shortcuts: mobileNavShortcuts,
  });

  return (
    <WorkspaceFocusProviderShell settingsByAccountId={focusSettingsByAccountId}>
      <SidebarProvider defaultOpen={layoutState.open}>
        <Page
          style={'sidebar'}
          contentContainerClassName="mx-auto flex h-svh min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)]"
        >
          <PageNavigation>
            <TeamAccountLayoutSidebar
              account={account}
              accountId={accountId}
              accounts={accounts}
              user={user}
              moduleSettings={moduleSettings}
              workspaceProfile={workspaceProfile}
              navCounts={navCounts}
              accountAccess={accountAccess}
            />
          </PageNavigation>

          <PageMobileNavigation className="hidden lg:px-0" />

          <TeamWorkspaceMobileChrome
            account={account}
            accountId={accountId}
            user={user}
            accounts={accounts}
            navLinks={mobileNavLinks}
            bottomNavTabs={bottomNavTabs}
            spaceType={spaceTypeFromProfile(workspaceProfile)}
            showNewMenu={showNewMenu}
          >
            {children}
          </TeamWorkspaceMobileChrome>
        </Page>
      </SidebarProvider>
    </WorkspaceFocusProviderShell>
  );
}

async function HeaderLayout({
  account,
  layoutState,
  children,
}: React.PropsWithChildren<{
  account: string;
  layoutState: LayoutState;
}>) {
  const user = await requireUserInServerComponent();
  if (await userRequiresWorkspaceSetup(user.id)) {
    redirect(workspaceSetupPath());
  }

  const client = (
    await import('@kit/supabase/server-client')
  ).getSupabaseServerClient();
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
  const focusAccountIds = [
    ...new Set([accountId, ...accounts.map((row) => row.id)]),
  ];

  const accountAccess = data.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const access = getTeamAccountAccess(accountAccess);
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);

  const adornments = await loadTeamWorkspaceShellAdornments({
    client,
    userId: user.id,
    accountId,
    accountSlug: account,
    moduleSettings: data.moduleSettings,
    focusAccountIds,
  });

  const mobileNavLinks = flattenTeamNavLinks(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      data.moduleSettings,
      workspaceProfile,
      adornments.navCounts,
    ),
  );

  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    shortcuts: adornments.mobileNavShortcuts,
  });

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <WorkspaceFocusProviderShell
        settingsByAccountId={adornments.focusSettingsByAccountId}
      >
        <Page style={'header'}>
          <PageNavigation>
            <TeamAccountNavigationMenu workspace={data} />
          </PageNavigation>

          <PageMobileNavigation className="hidden lg:px-0" />

          <TeamWorkspaceMobileChrome
            account={account}
            accountId={accountId}
            user={data.user}
            accounts={accounts}
            navLinks={mobileNavLinks}
            bottomNavTabs={bottomNavTabs}
            spaceType={spaceTypeFromProfile(workspaceProfile)}
            showNewMenu={access.canUseQuickCreate}
          >
            <BillingAccessBannerHost
              accountId={accountId}
              accountSlug={account}
              canManageBilling={access.canManageBilling}
            />
            {children}
          </TeamWorkspaceMobileChrome>
        </Page>
      </WorkspaceFocusProviderShell>
    </TeamAccountWorkspaceContextProvider>
  );
}

async function getLayoutState(account: string): Promise<LayoutState> {
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
