import { use } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { z } from 'zod';

import { UserWorkspaceContextProvider } from '@kit/accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { WorkspaceTopBar } from '~/components/workspace-shell/workspace-top-bar';
import pathsConfig from '~/config/paths.config';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';
import { personalAccountNavigationConfig } from '~/config/personal-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { HomeMenuNavigation } from './_components/home-menu-navigation';
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { PersonalHomeMobileChrome } from './_components/personal-home-mobile-chrome';
import { HomeSidebar } from './_components/home-sidebar';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';
import { loadPersonalSidebarWorkspaces } from './_lib/server/personal-sidebar-workspaces.loader';
import { flattenPersonalNavLinks } from './_lib/flatten-personal-nav-links';
import {
  buildPersonalHomeNavRoutes,
  parsePersonalAccountNavigationConfig,
} from '~/config/personal-account-navigation.config';
import { loadPersonalMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { loadWorkspaceSwitcherAccounts } from '~/home/_lib/server/workspace-switcher.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  userRequiresWorkspaceSetup,
  workspaceSetupPath,
} from '~/lib/server/workspace-setup-guard';

function UserHomeLayout({ children }: React.PropsWithChildren) {
  const state = use(getLayoutState());

  if (state.style === 'sidebar') {
    return <SidebarLayout>{children}</SidebarLayout>;
  }

  return <HeaderLayout>{children}</HeaderLayout>;
}

export default withI18n(UserHomeLayout);

async function SidebarLayout({ children }: React.PropsWithChildren) {
  const user = await requireUserInServerComponent();
  if (await userRequiresWorkspaceSetup(user.id)) {
    redirect(workspaceSetupPath());
  }

  let workspace: Awaited<ReturnType<typeof loadUserWorkspace>> | null = null;
  let sharedWorkspaces: Awaited<
    ReturnType<typeof loadPersonalSidebarWorkspaces>
  > = [];
  let switcherAccounts: Awaited<
    ReturnType<typeof loadWorkspaceSwitcherAccounts>
  > = [];
  let state: Awaited<ReturnType<typeof getLayoutState>>;
  let client: Awaited<
    ReturnType<(typeof import('@kit/supabase/server-client'))['getSupabaseServerClient']>
  > | null = null;
  try {
    client = (await import('@kit/supabase/server-client')).getSupabaseServerClient();
    [workspace, sharedWorkspaces, state, switcherAccounts] = await Promise.all([
      loadUserWorkspace(),
      loadPersonalSidebarWorkspaces(),
      getLayoutState(),
      loadWorkspaceSwitcherAccounts(client, user.id),
    ]);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    workspace = null;
    sharedWorkspaces = [];
    switcherAccounts = [];
    state = await getLayoutState();
  }

  if (!workspace) {
    return (
      <SidebarProvider defaultOpen={state!.open}>
        <Page style={'sidebar'}>{children}</Page>
      </SidebarProvider>
    );
  }

  const personalNavLinks = flattenPersonalNavLinks(
    parsePersonalAccountNavigationConfig(buildPersonalHomeNavRoutes()),
  );
  const mobileNavShortcuts = client
    ? await loadPersonalMobileNavShortcuts(client, user.id)
    : [];
  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath: pathsConfig.app.home,
    navLinks: personalNavLinks,
    shortcuts: mobileNavShortcuts,
  });

  return (
    <UserWorkspaceContextProvider value={workspace}>
      <SidebarProvider defaultOpen={state.open}>
        <Page
          style={'sidebar'}
          contentContainerClassName="mx-auto flex h-svh min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)]"
        >
          <PageNavigation>
            <HomeSidebar
              workspace={workspace}
              sharedWorkspaces={sharedWorkspaces}
            />
          </PageNavigation>

          <PageMobileNavigation className="hidden" />

          <PersonalHomeMobileChrome
            workspace={workspace}
            navLinks={personalNavLinks}
            bottomNavTabs={bottomNavTabs}
            switcherAccounts={switcherAccounts}
          >
            <div className="hidden lg:block">
              <WorkspaceTopBar
                variant="personal"
                userId={workspace.user.id}
                accountId={workspace.workspace?.id}
              />
            </div>
            {children}
          </PersonalHomeMobileChrome>
        </Page>
      </SidebarProvider>
    </UserWorkspaceContextProvider>
  );
}

function HeaderLayout({ children }: React.PropsWithChildren) {
  const workspace = use(loadUserWorkspace());

  return (
    <UserWorkspaceContextProvider value={workspace}>
      <Page style={'header'}>
        <PageNavigation>
          <HomeMenuNavigation workspace={workspace} />
        </PageNavigation>

        <PageMobileNavigation className={'flex items-center justify-between'}>
          <MobileNavigation workspace={workspace} />
        </PageMobileNavigation>

        {children}
      </Page>
    </UserWorkspaceContextProvider>
  );
}

function MobileNavigation({
  workspace,
}: {
  workspace: Awaited<ReturnType<typeof loadUserWorkspace>>;
}) {
  return (
    <>
      <AppLogo className={APP_LOGO_SHELL_CLASSNAME} />

      <HomeMobileNavigation workspace={workspace} />
    </>
  );
}

async function getLayoutState() {
  const cookieStore = await cookies();

  const LayoutStyleSchema = z.enum(['sidebar', 'header', 'custom']);

  const layoutStyleCookie = cookieStore.get('layout-style');
  const sidebarOpenCookie = cookieStore.get('sidebar:state');

  const sidebarOpen = sidebarOpenCookie
    ? sidebarOpenCookie.value === 'false'
    : !personalAccountNavigationConfig.sidebarCollapsed;

  const parsedStyle = LayoutStyleSchema.safeParse(layoutStyleCookie?.value);

  const style = parsedStyle.success
    ? parsedStyle.data
    : personalAccountNavigationConfig.style;

  return {
    open: sidebarOpen,
    style,
  };
}
