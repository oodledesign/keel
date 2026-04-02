import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarNavigation,
  SidebarTrigger,
} from '@kit/ui/shadcn-sidebar';

import { If } from '@kit/ui/if';
import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import featureFlagsConfig from '~/config/feature-flags.config';
import {
  buildPersonalAccountRoutes,
  parsePersonalAccountNavigationConfig,
  personalAccountNavigationConfig,
} from '~/config/personal-account-navigation.config';
import { APP_LOGO_SIDEBAR_CLASSNAME } from '~/lib/app-logo-shell';

import type { UserWorkspace } from '../_lib/server/load-user-workspace';

import { HomeAddAccountButton } from './home-add-account-button';

interface HomeSidebarProps {
  workspace: UserWorkspace;
}

export function HomeSidebar(props: HomeSidebarProps) {
  const { workspace, user, accounts, canCreateTeamAccount } = props.workspace;
  const collapsible = personalAccountNavigationConfig.sidebarCollapsedStyle;
  const teamAccounts = Array.isArray(accounts) ? accounts : [];

  let routes = buildPersonalAccountRoutes(teamAccounts);
  if (
    featureFlagsConfig.enableTeamAccounts &&
    featureFlagsConfig.enableTeamCreation
  ) {
    routes = routes.map((item) => {
      if ('label' in item && item.label === 'Business') {
        return {
          ...item,
          renderAction: (
            <HomeAddAccountButton
              canCreateTeamAccount={canCreateTeamAccount}
              className="h-8 border border-white/12 bg-white/[0.06] px-2 text-xs text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-active)]"
            />
          ),
        };
      }
      return item;
    });
  }

  const sidebarNavConfig =
    parsePersonalAccountNavigationConfig(routes);

  return (
    <Sidebar
      collapsible={collapsible}
      className="bg-[var(--workspace-shell-sidebar)] text-[var(--workspace-shell-text)] [--sidebar-background:var(--workspace-shell-sidebar)] [--sidebar-foreground:var(--workspace-shell-text)] [--sidebar-accent:var(--workspace-shell-sidebar-accent)] [--sidebar-accent-foreground:#ffffff] [--sidebar-border:rgba(255,255,255,0.08)] [&_[data-sidebar=sidebar]]:bg-[var(--workspace-shell-sidebar)] [&_[data-sidebar=sidebar]]:text-[var(--workspace-shell-text)] [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-white/6 [&_[data-sidebar=menu-button]]:h-10 [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:px-3 [&_[data-sidebar=menu-button]]:text-[0.95rem] [&_[data-sidebar=menu-button][data-active=true]]:bg-[var(--workspace-shell-sidebar-active)] [&_[data-sidebar=menu-button][data-active=true]]:text-white [&_[data-sidebar=menu-button]]:text-[var(--workspace-shell-text)] [&_[data-sidebar=menu-button]:hover]:bg-[var(--workspace-shell-sidebar-active)] [&_[data-sidebar=menu-button]:hover]:text-white"
    >
      <SidebarHeader className="h-16 justify-center border-b border-white/6 px-3">
        <div className="flex items-center justify-between gap-x-3">
          <AppLogo
            className={cn(
              APP_LOGO_SIDEBAR_CLASSNAME,
              'group-data-[minimized=true]/sidebar:max-w-full group-data-[minimized=true]/sidebar:py-0',
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="mt-4 px-2 pb-4">
        <SidebarNavigation config={sidebarNavConfig} />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/6 px-2 py-3">
        <div className="mb-2 flex items-center justify-center">
          <SidebarTrigger className="h-8 w-8 rounded-md border border-white/12 bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-active)]" />
        </div>
        <ProfileAccountDropdownContainer
          user={user}
          account={
            workspace
              ? {
                  id: workspace.id,
                  name: workspace.name,
                  picture_url: workspace.picture_url,
                }
              : undefined
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}
