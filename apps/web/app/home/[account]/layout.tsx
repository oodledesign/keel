import { use } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { z } from 'zod';

import { AdminImpersonationExitHost } from '@kit/admin/components/admin-impersonation-exit-host';
import { TeamAccountWorkspaceContextProvider } from '@kit/team-accounts/components';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AiCreditsExhaustedShell } from '~/components/ai/ai-credits-exhausted-shell';
import { PersonalVisionChromeShell } from '~/components/personal-vision/personal-vision-chrome-shell';
import { ProductTourHost } from '~/components/product-tour/product-tour-host';
import { TeamWorkspaceTopBarClient } from '~/components/workspace-shell/team-workspace-top-bar-client';
import { WorkspaceFocusProviderShell } from '~/components/workspace-shell/workspace-focus-provider-shell';
import pathsConfig from '~/config/paths.config';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { listUserClientPortalMemberships } from '~/home/(user)/_lib/server/list-user-client-portal-memberships';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import { withI18n } from '~/lib/i18n/with-i18n';
import { resolveMobileBottomNavTabs } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import type { CompletedProductTours } from '~/lib/product-tour/types';
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
import { TeamWorkspaceShellAdornmentsSuspense } from './_components/team-workspace-shell-adornments-suspense';
import { flattenTeamNavSections } from './_lib/flatten-team-nav-links';
import { getTeamAccountAccess } from './_lib/role-access';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';
import {
  type TeamWorkspaceShellAdornments,
  loadTeamWorkspaceShellAdornments,
} from './_lib/server/team-workspace-shell-adornments.loader';
import { enforceWorkspaceBilling } from './_lib/server/workspace-billing-guard';
import { spaceTypeFromProfile } from './_lib/workspace-profile';
import { SopTrackerHost } from './sops/_components/sop-tracker-host';

const EMPTY_SHELL_ADORNMENTS: TeamWorkspaceShellAdornments = {
  navCounts: {},
  mobileNavShortcuts: [],
  focusSettingsByAccountId: {},
  emailAssistantAvailable: false,
  pipelineBoardName: undefined,
};

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
      <>
        <AdminImpersonationExitHost />
        <SidebarLayout account={account} layoutState={state}>
          {children}
        </SidebarLayout>
      </>
    );
  }

  return (
    <>
      <AdminImpersonationExitHost />
      <HeaderLayout account={account} layoutState={state}>
        {children}
      </HeaderLayout>
    </>
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

  const [data, switcherAccounts, switcherPortals, completedTours] =
    await Promise.all([
      loadTeamWorkspace(account),
      loadWorkspaceSwitcherAccounts(client, user.id),
      listUserClientPortalMemberships(user.id),
      (
        await import('~/lib/product-tour/product-tour.actions')
      ).loadCompletedProductTours(),
    ]);

  await enforceWorkspaceBilling(account);

  if (!data) {
    redirect('/');
  }

  const accountId = data.account.id;
  const workspaceProfile = data.workspaceProfile;
  const accounts = switcherAccounts.length > 0 ? switcherAccounts : [];
  const portals = switcherPortals;
  const focusAccountIds = [
    ...new Set([accountId, ...accounts.map((row) => row.id)]),
  ];

  const { data: membershipRow } = await client
    .from('accounts_memberships')
    .select('onboarding_completed')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const onboardingCompleted =
    (membershipRow as { onboarding_completed?: boolean | null } | null)
      ?.onboarding_completed === true;

  const accountAccess = data.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };

  const access = getTeamAccountAccess(accountAccess);
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);

  const workspaceOptions = accounts
    .filter((row) => Boolean(row.slug))
    .map((row) => ({ slug: String(row.slug), name: row.label }));

  const oooWorkspaces = Array.from(
    new Map(
      [
        {
          id: accountId,
          slug: account,
          name: data.account.name?.trim() || account,
        },
        ...accounts
          .filter((row) => Boolean(row.slug))
          .map((row) => ({
            id: row.id,
            slug: String(row.slug),
            name: row.label,
          })),
      ].map((workspace) => [workspace.id, workspace]),
    ).values(),
  );

  const shellProps = {
    account,
    accountId,
    user: data.user,
    accounts,
    portals,
    moduleSettings: data.moduleSettings,
    workspaceProfile,
    accountAccess,
    layoutState,
    showNewMenu: access.canUseQuickCreate,
    homePath,
    completedTours,
    onboardingCompleted,
    workspaceOptions,
    oooWorkspaces,
  };

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <TeamWorkspaceShellAdornmentsSuspense
        client={client}
        userId={user.id}
        accountId={accountId}
        accountSlug={account}
        moduleSettings={data.moduleSettings}
        focusAccountIds={focusAccountIds}
        loadPipelineBoardName={workspaceProfile === 'commercial_property'}
        fallback={
          <TeamWorkspaceSidebarShell
            {...shellProps}
            {...EMPTY_SHELL_ADORNMENTS}
          >
            <TeamWorkspaceTopBarClient accountSlug={account} />
            <AiCreditsExhaustedShell
              accountId={accountId}
              billingHref={toHomeBillingHref(
                pathsConfig.app.accountBilling,
                account,
              )}
            >
              <BillingAccessBannerHost
                accountId={accountId}
                accountSlug={account}
                canManageBilling={access.canManageBilling}
              />
              {children}
            </AiCreditsExhaustedShell>
          </TeamWorkspaceSidebarShell>
        }
      >
        {(adornments) => (
          <TeamWorkspaceSidebarShell {...shellProps} {...adornments}>
            <TeamWorkspaceTopBarClient accountSlug={account} />
            <AiCreditsExhaustedShell
              accountId={accountId}
              billingHref={toHomeBillingHref(
                pathsConfig.app.accountBilling,
                account,
              )}
            >
              <BillingAccessBannerHost
                accountId={accountId}
                accountSlug={account}
                canManageBilling={access.canManageBilling}
              />
              {children}
            </AiCreditsExhaustedShell>
          </TeamWorkspaceSidebarShell>
        )}
      </TeamWorkspaceShellAdornmentsSuspense>
    </TeamAccountWorkspaceContextProvider>
  );
}

function TeamWorkspaceSidebarShell({
  account,
  accountId,
  user,
  accounts,
  portals = [],
  moduleSettings,
  workspaceProfile,
  accountAccess,
  navCounts,
  emailAssistantAvailable,
  pipelineBoardName,
  mobileNavShortcuts,
  focusSettingsByAccountId,
  layoutState,
  showNewMenu,
  homePath,
  completedTours,
  onboardingCompleted,
  workspaceOptions,
  oooWorkspaces,
  children,
}: {
  account: string;
  accountId: string;
  user: React.ComponentProps<typeof TeamAccountLayoutSidebar>['user'];
  accounts: React.ComponentProps<typeof TeamAccountLayoutSidebar>['accounts'];
  portals?: React.ComponentProps<typeof TeamAccountLayoutSidebar>['portals'];
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
  emailAssistantAvailable: boolean;
  pipelineBoardName?: string;
  mobileNavShortcuts: Awaited<
    ReturnType<typeof loadTeamWorkspaceShellAdornments>
  >['mobileNavShortcuts'];
  focusSettingsByAccountId: Record<string, WorkspaceFocusInput>;
  layoutState: LayoutState;
  showNewMenu: boolean;
  homePath: string;
  completedTours: CompletedProductTours;
  onboardingCompleted: boolean;
  workspaceOptions: Array<{ slug: string; name: string }>;
  oooWorkspaces: Array<{ id: string; slug: string; name: string }>;
  children: React.ReactNode;
}) {
  const mobileNavSections = flattenTeamNavSections(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      moduleSettings,
      workspaceProfile,
      navCounts,
      { emailAssistantAvailable, pipelineBoardName },
    ),
  );

  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    shortcuts: mobileNavShortcuts,
  });

  return (
    <PersonalVisionChromeShell>
      <WorkspaceFocusProviderShell
        settingsByAccountId={focusSettingsByAccountId}
        supportDefaultAccountId={accountId}
        oooWorkspaces={oooWorkspaces}
        oooDefaultAccountId={accountId}
      >
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
                portals={portals}
                user={user}
                moduleSettings={moduleSettings}
                workspaceProfile={workspaceProfile}
                navCounts={navCounts}
                emailAssistantAvailable={emailAssistantAvailable}
                pipelineBoardName={pipelineBoardName}
                accountAccess={accountAccess}
              />
            </PageNavigation>

            <PageMobileNavigation className="hidden lg:px-0" />

            <TeamWorkspaceMobileChrome
              account={account}
              accountId={accountId}
              user={user}
              accounts={accounts}
              portals={portals}
              navSections={mobileNavSections}
              bottomNavTabs={bottomNavTabs}
              spaceType={spaceTypeFromProfile(workspaceProfile)}
              showNewMenu={showNewMenu}
              sopTracker={
                <Suspense fallback={null}>
                  <SopTrackerHost
                    accountId={accountId}
                    accountSlug={account}
                  />
                </Suspense>
              }
            >
              <ProductTourHost
                variant="team"
                completedTours={completedTours}
                workspaceProfile={workspaceProfile}
                accountSlug={account}
                onboardingCompleted={onboardingCompleted}
                workspaceOptions={workspaceOptions}
              />
              {children}
            </TeamWorkspaceMobileChrome>
          </Page>
        </SidebarProvider>
      </WorkspaceFocusProviderShell>
    </PersonalVisionChromeShell>
  );
}

async function HeaderLayout({
  account,
  layoutState: _layoutState,
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
  const [data, switcherAccounts, switcherPortals] = await Promise.all([
    loadTeamWorkspace(account),
    loadWorkspaceSwitcherAccounts(client, user.id),
    listUserClientPortalMemberships(user.id),
    enforceWorkspaceBilling(account),
  ]);

  if (!data) {
    redirect('/');
  }

  const accountId = data.account.id;
  const accounts = switcherAccounts;
  const portals = switcherPortals;
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

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <TeamWorkspaceShellAdornmentsSuspense
        client={client}
        userId={user.id}
        accountId={accountId}
        accountSlug={account}
        moduleSettings={data.moduleSettings}
        focusAccountIds={focusAccountIds}
        loadPipelineBoardName={data.workspaceProfile === 'commercial_property'}
        fallback={
          <HeaderLayoutShell
            account={account}
            accountId={accountId}
            data={data}
            accounts={accounts}
            portals={portals}
            accountAccess={accountAccess}
            access={access}
            homePath={homePath}
            adornments={EMPTY_SHELL_ADORNMENTS}
          >
            {children}
          </HeaderLayoutShell>
        }
      >
        {(adornments) => (
          <HeaderLayoutShell
            account={account}
            accountId={accountId}
            data={data}
            accounts={accounts}
            portals={portals}
            accountAccess={accountAccess}
            access={access}
            homePath={homePath}
            adornments={adornments}
          >
            {children}
          </HeaderLayoutShell>
        )}
      </TeamWorkspaceShellAdornmentsSuspense>
    </TeamAccountWorkspaceContextProvider>
  );
}

function HeaderLayoutShell({
  account,
  accountId,
  data,
  accounts,
  portals = [],
  accountAccess,
  access,
  homePath,
  adornments,
  children,
}: React.PropsWithChildren<{
  account: string;
  accountId: string;
  data: NonNullable<Awaited<ReturnType<typeof loadTeamWorkspace>>>;
  accounts: React.ComponentProps<typeof TeamWorkspaceMobileChrome>['accounts'];
  portals?: React.ComponentProps<typeof TeamWorkspaceMobileChrome>['portals'];
  accountAccess: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  access: ReturnType<typeof getTeamAccountAccess>;
  homePath: string;
  adornments: TeamWorkspaceShellAdornments;
}>) {
  const mobileNavSections = flattenTeamNavSections(
    getTeamAccountSidebarConfig(
      account,
      accountAccess,
      data.moduleSettings,
      data.workspaceProfile,
      adornments.navCounts,
      {
        emailAssistantAvailable: adornments.emailAssistantAvailable,
        pipelineBoardName: adornments.pipelineBoardName,
      },
    ),
  );

  const bottomNavTabs = resolveMobileBottomNavTabs({
    homePath,
    shortcuts: adornments.mobileNavShortcuts,
  });

  return (
    <PersonalVisionChromeShell>
      <WorkspaceFocusProviderShell
        settingsByAccountId={adornments.focusSettingsByAccountId}
        supportDefaultAccountId={accountId}
        oooWorkspaces={Array.from(
          new Map(
            [
              {
                id: accountId,
                slug: account,
                name: data.account.name?.trim() || account,
              },
              ...accounts
                .filter((row) => Boolean(row.slug))
                .map((row) => ({
                  id: row.id,
                  slug: String(row.slug),
                  name: row.label,
                })),
            ].map((workspace) => [workspace.id, workspace]),
          ).values(),
        )}
        oooDefaultAccountId={accountId}
      >
        <Page style={'header'}>
          <PageNavigation>
            <TeamAccountNavigationMenu
              workspace={data}
              accounts={accounts}
              portals={portals}
              emailAssistantAvailable={adornments.emailAssistantAvailable}
              pipelineBoardName={adornments.pipelineBoardName}
            />
          </PageNavigation>

          <PageMobileNavigation className="hidden lg:px-0" />

          <TeamWorkspaceMobileChrome
            account={account}
            accountId={accountId}
            user={data.user}
            accounts={accounts}
            portals={portals}
            navSections={mobileNavSections}
            bottomNavTabs={bottomNavTabs}
            spaceType={spaceTypeFromProfile(data.workspaceProfile)}
            showNewMenu={access.canUseQuickCreate}
            sopTracker={
              <Suspense fallback={null}>
                <SopTrackerHost accountId={accountId} accountSlug={account} />
              </Suspense>
            }
          >
            <AiCreditsExhaustedShell
              accountId={accountId}
              billingHref={toHomeBillingHref(
                pathsConfig.app.accountBilling,
                account,
              )}
            >
              <BillingAccessBannerHost
                accountId={accountId}
                accountSlug={account}
                canManageBilling={access.canManageBilling}
              />
              {children}
            </AiCreditsExhaustedShell>
          </TeamWorkspaceMobileChrome>
        </Page>
      </WorkspaceFocusProviderShell>
    </PersonalVisionChromeShell>
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
