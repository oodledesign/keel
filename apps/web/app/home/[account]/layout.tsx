import { use } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { TeamAccountWorkspaceContextProvider } from '@kit/team-accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamWorkspaceTopBarSlot } from '~/components/workspace-shell/workspace-top-bar-slot';

import { TeamAccountLayoutMobileNavigation } from './_components/team-account-layout-mobile-navigation';
import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';
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
  ]);

  const navCounts = await loadWorkNavCounts(
    client,
    data.account.id,
    data.moduleSettings,
  ).catch((error) => {
    console.error('[team-workspace] loadWorkNavCounts:', error);
    return {} as WorkNavCounts;
  });

  if (!data) {
    redirect('/');
  }

  await enforceWorkspaceBilling(account);

  const workspaceProfile = data.workspaceProfile;
  const accounts =
    switcherAccounts.length > 0 ? switcherAccounts : [];

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <SidebarProvider defaultOpen={state.open}>
        <Page
          style={'sidebar'}
          contentContainerClassName="mx-auto flex h-screen w-full min-w-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)]"
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
              accountAccess={
                data.account as {
                  permissions?: string[] | null;
                  role?: string | null;
                  company_role?: string | null;
                }
              }
            />
          </PageNavigation>

          <PageMobileNavigation className="flex items-center justify-between bg-[var(--workspace-shell-header)] px-4 py-2 text-[var(--workspace-shell-text)] border-b border-white/6 lg:px-0">
            <AppLogo
              className={APP_LOGO_SHELL_CLASSNAME}
              href={pathsConfig.app.accountHome.replace('[account]', account)}
            />

            <div className={'flex items-center gap-x-3'}>
              <TeamAccountLayoutMobileNavigation
                userId={data.user.id}
                accounts={accounts}
                account={account}
                workspaceProfile={workspaceProfile}
                moduleSettings={data.moduleSettings}
                navCounts={navCounts}
                accountAccess={
                  data.account as {
                    permissions?: string[] | null;
                    role?: string | null;
                    company_role?: string | null;
                  }
                }
              />
              <ProfileAccountDropdownContainer
                user={data.user}
                account={undefined}
              />
            </div>
          </PageMobileNavigation>

          <TeamWorkspaceTopBarSlot account={account} />
          {children}
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
  ]);

  if (!data) {
    redirect('/');
  }

  await enforceWorkspaceBilling(account);

  const workspaceProfile = data.workspaceProfile;
  const accounts = switcherAccounts;
  const navCounts = await loadWorkNavCounts(
    client,
    data.account.id,
    data.moduleSettings,
  ).catch((error) => {
    console.error('[team-workspace] loadWorkNavCounts:', error);
    return {} as WorkNavCounts;
  });

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <Page style={'header'}>
        <PageNavigation>
          <TeamAccountNavigationMenu workspace={data} />
        </PageNavigation>

        <PageMobileNavigation className="flex items-center justify-between bg-[var(--workspace-shell-header)] px-4 py-2 text-[var(--workspace-shell-text)] border-b border-white/6 lg:px-0">
          <AppLogo
            className={APP_LOGO_SHELL_CLASSNAME}
            href={pathsConfig.app.accountHome.replace('[account]', account)}
          />

          <div className={'flex items-center gap-x-3 group-data-[mobile:hidden]'}>
            <TeamAccountLayoutMobileNavigation
              userId={data.user.id}
              accounts={accounts}
              account={account}
              workspaceProfile={workspaceProfile}
              moduleSettings={data.moduleSettings}
              navCounts={navCounts}
              accountAccess={
                data.account as {
                  permissions?: string[] | null;
                  role?: string | null;
                  company_role?: string | null;
                }
              }
            />
            <ProfileAccountDropdownContainer
              user={data.user}
              account={undefined}
            />
          </div>
        </PageMobileNavigation>

        {children}
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
