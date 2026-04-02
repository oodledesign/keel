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
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamAccountLayoutMobileNavigation } from './_components/team-account-layout-mobile-navigation';
import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import { getSpaceTypeFromAccount } from './_lib/server/account-modules';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';

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
  const [data, state] = await Promise.all([
    loadTeamWorkspace(account),
    getLayoutState(account),
  ]);

  if (!data) {
    redirect('/');
  }

  const accounts = data.accounts.map(
    ({ name, slug, picture_url, role }: { name: string | null; slug: string | null; picture_url: string | null; role?: string | null }) => ({
      label: name ?? '',
      value: slug,
      image: picture_url,
      role: role ?? null,
    }),
  );

  const spaceType = getSpaceTypeFromAccount(
    data.account as { space_type?: string | null },
  );

  return (
    <TeamAccountWorkspaceContextProvider value={data}>
      <SidebarProvider defaultOpen={state.open}>
        <Page style={'sidebar'}>
          <PageNavigation>
            <TeamAccountLayoutSidebar
              account={account}
              accountId={data.account.id}
              accounts={accounts}
              user={data.user}
              moduleSettings={data.moduleSettings}
              spaceType={spaceType}
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
                spaceType={spaceType}
                moduleSettings={data.moduleSettings}
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
      </SidebarProvider>
    </TeamAccountWorkspaceContextProvider>
  );
}

function HeaderLayout({
  account,
  children,
}: React.PropsWithChildren<{
  account: string;
}>) {
  const data = use(loadTeamWorkspace(account));

  const accounts = data.accounts.map(
    ({ name, slug, picture_url, role }: { name: string | null; slug: string | null; picture_url: string | null; role?: string | null }) => ({
      label: name ?? '',
      value: slug,
      image: picture_url,
      role: role ?? null,
    }),
  );

  const spaceType = getSpaceTypeFromAccount(
    data.account as { space_type?: string | null },
  );

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
              spaceType={spaceType}
              moduleSettings={data.moduleSettings}
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
