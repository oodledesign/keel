import { Suspense, use } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { UserWorkspaceContextProvider } from '@kit/accounts/components';
import { AdminImpersonationExitHost } from '@kit/admin/components/admin-impersonation-exit-host';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AiCreditsExhaustedShell } from '~/components/ai/ai-credits-exhausted-shell';
import { AppLogo } from '~/components/app-logo';
import { PersonalVisionChromeShell } from '~/components/personal-vision/personal-vision-chrome-shell';
import { ProductTourHost } from '~/components/product-tour/product-tour-host';
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
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';
import { enrichPersonalShortcutsWithWorkspaceAvatars } from '~/lib/dashboard-shortcuts/enrich-workspace-shortcut-avatars';
import { loadPersonalMobileNavShortcuts } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';
import { withI18n } from '~/lib/i18n/with-i18n';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { loadCompletedProductTours } from '~/lib/product-tour/product-tour.actions';
import type { CompletedProductTours } from '~/lib/product-tour/types';
import { buildPersonalShellMetadata } from '~/lib/seo/app-shell-metadata';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  userRequiresWorkspaceSetup,
  workspaceSetupPath,
} from '~/lib/server/workspace-setup-guard';
import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

import { FeedflowQueryErrorToast } from '../_components/feedflow-query-error-toast';
import { HomeMenuNavigation } from './_components/home-menu-navigation';
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { HomeSidebar } from './_components/home-sidebar';
import { PersonalHomeMobileChrome } from './_components/personal-home-mobile-chrome';
import { PersonalHomeShellAdornmentsSuspense } from './_components/personal-home-shell-adornments-suspense';
import { flattenPersonalNavLinks } from './_lib/flatten-personal-nav-links';
import { listUserClientPortalMemberships } from './_lib/server/list-user-client-portal-memberships';
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
    return (
      <>
        <AdminImpersonationExitHost />
        <Suspense fallback={null}>
          <FeedflowQueryErrorToast />
        </Suspense>
        <SidebarLayout layoutState={state}>{children}</SidebarLayout>
      </>
    );
  }

  return (
    <>
      <AdminImpersonationExitHost />
      <Suspense fallback={null}>
        <FeedflowQueryErrorToast />
      </Suspense>
      <HeaderLayout>{children}</HeaderLayout>
    </>
  );
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
  let switcherPortals: Awaited<
    ReturnType<typeof listUserClientPortalMemberships>
  > = [];
  let client: Awaited<
    ReturnType<
      (typeof import('@kit/supabase/server-client'))['getSupabaseServerClient']
    >
  > | null = null;

  let completedTours: CompletedProductTours = {};

  try {
    client = (
      await import('@kit/supabase/server-client')
    ).getSupabaseServerClient();
    [
      workspace,
      sharedWorkspaces,
      switcherAccounts,
      switcherPortals,
      completedTours,
    ] = await Promise.all([
      loadUserWorkspace(),
      loadPersonalSidebarWorkspaces(),
      loadWorkspaceSwitcherAccounts(client, user.id),
      listUserClientPortalMemberships(user.id),
      loadCompletedProductTours(),
    ]);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    workspace = null;
    sharedWorkspaces = [];
    switcherAccounts = [];
    switcherPortals = [];
    // Empty map may replay the tour after a transient load failure — acceptable.
    completedTours = {};
  }

  if (!workspace) {
    return (
      <SidebarProvider defaultOpen={layoutState.open}>
        <Page style={'sidebar'}>{children}</Page>
      </SidebarProvider>
    );
  }

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
    emailNeedsReplyCount?: number;
  }) => {
    const navLinks = flattenPersonalNavLinks(
      parsePersonalAccountNavigationConfig(
        buildPersonalHomeNavRoutes({
          emailNeedsReplyCount: params.emailNeedsReplyCount,
        }),
      ),
    );
    const bottomNavTabs = resolveMobileBottomNavTabs({
      homePath: getExplicitPersonalHomePath(),
      shortcuts: enrichPersonalShortcutsWithWorkspaceAvatars(
        params.mobileNavShortcuts,
        shortcutWorkspaceRows,
      ),
    });

    const workspaceOptions = switcherAccounts
      .filter((row) => Boolean(row.slug))
      .map((row) => ({ slug: String(row.slug), name: row.label }));

    const oooWorkspaces = Array.from(
      new Map(
        [
          ...sharedWorkspaces
            .filter((row) => Boolean(row.slug))
            .map((row) => ({
              id: row.id,
              slug: String(row.slug),
              name: row.label,
            })),
          ...switcherAccounts
            .filter((row) => Boolean(row.slug))
            .map((row) => ({
              id: row.id,
              slug: String(row.slug),
              name: row.label,
            })),
        ].map((workspace) => [workspace.id, workspace]),
      ).values(),
    );

    return (
      <PersonalVisionChromeShell>
        <WorkspaceFocusProviderShell
          settingsByAccountId={params.focusSettingsByAccountId}
          oooWorkspaces={oooWorkspaces}
          oooDefaultAccountId={oooWorkspaces[0]?.id ?? null}
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
                  switcherPortals={switcherPortals}
                  emailNeedsReplyCount={params.emailNeedsReplyCount}
                  completedTours={completedTours}
                />
              </PageNavigation>

              <PageMobileNavigation className="hidden" />

              <PersonalHomeMobileChrome
                workspace={workspaceForShell}
                navLinks={navLinks}
                bottomNavTabs={bottomNavTabs}
                switcherAccounts={switcherAccounts}
                switcherPortals={switcherPortals}
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
                            picture_url:
                              workspaceForShell.workspace.picture_url,
                          }
                        : undefined
                    }
                    accountId={workspaceForShell.workspace?.id ?? undefined}
                  />
                </div>
                <AiCreditsExhaustedShell
                  accountId={workspaceForShell.user.id}
                  billingHref={toHomeBillingHref(
                    pathsConfig.app.personalAccountBilling,
                  )}
                >
                  <ProductTourHost
                    variant="personal"
                    completedTours={completedTours}
                    workspaceOptions={workspaceOptions}
                  />
                  {children}
                </AiCreditsExhaustedShell>
              </PersonalHomeMobileChrome>
            </Page>
          </SidebarProvider>
        </WorkspaceFocusProviderShell>
      </PersonalVisionChromeShell>
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
            emailNeedsReplyCount: adornments.emailNeedsReplyCount,
          })
        }
      </PersonalHomeShellAdornmentsSuspense>
    </UserWorkspaceContextProvider>
  );
}

function HeaderLayout({ children }: React.PropsWithChildren) {
  const workspace = use(loadUserWorkspace());

  return (
    <PersonalVisionChromeShell>
      <UserWorkspaceContextProvider value={workspace}>
        <Page style={'header'}>
          <PageNavigation>
            <HomeMenuNavigation workspace={workspace} />
          </PageNavigation>

          <PageMobileNavigation className={'flex items-center justify-between'}>
            <MobileNavigation workspace={workspace} />
          </PageMobileNavigation>

          <AiCreditsExhaustedShell
            accountId={workspace.user.id}
            billingHref={toHomeBillingHref(
              pathsConfig.app.personalAccountBilling,
            )}
          >
            {children}
          </AiCreditsExhaustedShell>
        </Page>
      </UserWorkspaceContextProvider>
    </PersonalVisionChromeShell>
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
