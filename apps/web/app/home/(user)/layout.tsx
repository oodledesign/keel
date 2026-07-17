import { Suspense, use } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { UserWorkspaceContextProvider } from '@kit/accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { WorkspaceFocusProviderShell } from '~/components/workspace-shell/workspace-focus-provider-shell';
import { WorkspaceTopBar } from '~/components/workspace-shell/workspace-top-bar';
import pathsConfig from '~/config/paths.config';
import { personalAccountNavigationConfig } from '~/config/personal-account-navigation.config';
import {
  buildPersonalHomeNavRoutes,
  parsePersonalAccountNavigationConfig,
} from '~/config/personal-account-navigation.config';
import type { WorkspaceAccountRow } from '~/home/_lib/server/workspace-scope';
import { loadWorkspaceSwitcherAccounts } from '~/home/_lib/server/workspace-switcher.loader';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';
import { enrichPersonalShortcutsWithWorkspaceAvatars } from '~/lib/dashboard-shortcuts/enrich-workspace-shortcut-avatars';
import { loadPersonalMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';
import { withI18n } from '~/lib/i18n/with-i18n';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { buildPersonalShellMetadata } from '~/lib/seo/app-shell-metadata';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  userRequiresWorkspaceSetup,
  workspaceSetupPath,
} from '~/lib/server/workspace-setup-guard';
import type { WorkspaceFocusInput } from '~/lib/workspace-focus';
import { loadWorkspaceFocusSettingsMap } from '~/lib/workspace-focus/load-workspace-focus-settings';
import { serializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

import { HomeMenuNavigation } from './_components/home-menu-navigation';
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { HomeSidebar } from './_components/home-sidebar';
import { PersonalHomeMobileChrome } from './_components/personal-home-mobile-chrome';
import { PersonalHomeShellAdornmentsSuspense } from './_components/personal-home-shell-adornments-suspense';
import { flattenPersonalNavLinks } from './_lib/flatten-personal-nav-links';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';
import { loadPersonalSidebarWorkspaces } from './_lib/server/personal-sidebar-workspaces.loader';

export const generateMetadata = async () => buildPersonalShellMetadata();

type LayoutState = {
  open: boolean;
  style: 'sidebar' | 'header' | 'custom';
};

function UserHomeLayout({ children }: React.PropsWithChildren) {
  const state = use(getLayoutState());

  if (state.style === 'sidebar') {
    return <SidebarLayout layoutState={state}>{children}</SidebarLayout>;
  }

  return <HeaderLayout>{children}</HeaderLayout>;
}

export default withI18n(UserHomeLayout);

async function SidebarLayout({
  children,
  layoutState,
}: React.PropsWithChildren<{ layoutState: LayoutState }>) {
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
  let client: Awaited<
    ReturnType<
      (typeof import('@kit/supabase/server-client'))['getSupabaseServerClient']
    >
  > | null = null;

  try {
    client = (
      await import('@kit/supabase/server-client')
    ).getSupabaseServerClient();
    [workspace, sharedWorkspaces, switcherAccounts] = await Promise.all([
      loadUserWorkspace(),
      loadPersonalSidebarWorkspaces(),
      loadWorkspaceSwitcherAccounts(client, user.id),
    ]);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    workspace = null;
    sharedWorkspaces = [];
    switcherAccounts = [];
  }

  if (!workspace) {
    return (
      <SidebarProvider defaultOpen={layoutState.open}>
        <Page style={'sidebar'}>{children}</Page>
      </SidebarProvider>
    );
  }

  const personalNavLinks = flattenPersonalNavLinks(
    parsePersonalAccountNavigationConfig(buildPersonalHomeNavRoutes()),
  );
  const focusAccountIds = [
    ...new Set([
      ...sharedWorkspaces.map((workspaceRow) => workspaceRow.id),
      ...switcherAccounts.map((account) => account.id),
    ]),
  ];
  const workspaceForShell = workspace;
  const shortcutWorkspaceRows: WorkspaceAccountRow[] = sharedWorkspaces.map(
    (row) => ({
      id: row.id,
      name: row.label,
      slug: row.slug,
      space_type: row.spaceType ?? null,
      is_personal_account: false,
      picture_url: row.pictureUrl ?? null,
    }),
  );

  const renderShell = (params: {
    mobileNavShortcuts: Awaited<
      ReturnType<typeof loadPersonalMobileNavShortcuts>
    >;
    focusSettingsByAccountId: Record<string, WorkspaceFocusInput>;
  }) => {
    const bottomNavTabs = resolveMobileBottomNavTabs({
      homePath: getExplicitPersonalHomePath(),
      shortcuts: enrichPersonalShortcutsWithWorkspaceAvatars(
        params.mobileNavShortcuts,
        shortcutWorkspaceRows,
      ),
    });

    return (
      <WorkspaceFocusProviderShell
        settingsByAccountId={params.focusSettingsByAccountId}
      >
        <SidebarProvider defaultOpen={layoutState.open}>
          <Page
            style={'sidebar'}
            contentContainerClassName="mx-auto flex h-svh min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)]"
          >
            <PageNavigation>
              <HomeSidebar
                workspace={workspaceForShell}
                sharedWorkspaces={sharedWorkspaces}
                switcherAccounts={switcherAccounts}
              />
            </PageNavigation>

            <PageMobileNavigation className="hidden" />

            <PersonalHomeMobileChrome
              workspace={workspaceForShell}
              navLinks={personalNavLinks}
              bottomNavTabs={bottomNavTabs}
              switcherAccounts={switcherAccounts}
            >
              <div className="hidden lg:block">
                <WorkspaceTopBar
                  variant="personal"
                  userId={workspaceForShell.user.id}
                  user={workspaceForShell.user}
                  account={
                    workspaceForShell.workspace
                      ? {
                          id: workspaceForShell.workspace.id,
                          name: workspaceForShell.workspace.name,
                          picture_url: workspaceForShell.workspace.picture_url,
                        }
                      : undefined
                  }
                  accountId={workspaceForShell.workspace?.id ?? undefined}
                />
              </div>
              {children}
            </PersonalHomeMobileChrome>
          </Page>
        </SidebarProvider>
      </WorkspaceFocusProviderShell>
    );
  };

  if (!client) {
    return renderShell({
      mobileNavShortcuts: [],
      focusSettingsByAccountId: {},
    });
  }

  return (
    <UserWorkspaceContextProvider value={workspace}>
      <PersonalHomeShellAdornmentsSuspense
        client={client}
        userId={user.id}
        focusAccountIds={focusAccountIds}
        fallback={renderShell({
          mobileNavShortcuts: [],
          focusSettingsByAccountId: {},
        })}
      >
        {(adornments) =>
          renderShell({
            mobileNavShortcuts: adornments.mobileNavShortcuts,
            focusSettingsByAccountId: adornments.focusSettingsByAccountId,
          })
        }
      </PersonalHomeShellAdornmentsSuspense>
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
