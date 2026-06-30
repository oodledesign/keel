'use client';

import { useContext } from 'react';

import Link from 'next/link';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarNavigation,
  SidebarTrigger,
  SidebarContext,
} from '@kit/ui/shadcn-sidebar';

import { If } from '@kit/ui/if';
import { cn } from '@kit/ui/utils';

import { KeelSidebarLogo } from '~/components/workspace-shell/keel-sidebar-logo';
import {
  WorkspaceAccountsSelector,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import { workspaceSidebarClassName } from '~/components/workspace-shell/workspace-shell-styles';
import featureFlagsConfig from '~/config/feature-flags.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import { PERSONAL_WORKSPACE_VALUE } from '~/lib/workspace-personal-switcher';
import {
  buildPersonalHomeNavRoutes,
  parsePersonalAccountNavigationConfig,
  personalAccountNavigationConfig,
  personalAccountSettingsPath,
  PersonalSettingsIcon,
} from '~/config/personal-account-navigation.config';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';

import type { UserWorkspace } from '../_lib/server/load-user-workspace';

import { PersonalWorkspaceNav } from './personal-workspace-nav';

interface HomeSidebarProps {
  workspace: UserWorkspace;
  switcherAccounts: WorkspaceSwitcherAccount[];
  /** Shared workspaces for sidebar shortcuts (from memberships). */
  sharedWorkspaces?: Array<{
    id: string;
    label: string;
    slug: string;
    pictureUrl: string | null;
  }>;
}

export function HomeSidebar(props: HomeSidebarProps) {
  const { workspace, user } = props.workspace;
  const collapsible = personalAccountNavigationConfig.sidebarCollapsedStyle;
  const sharedWorkspaces = props.sharedWorkspaces ?? [];
  const switcherAccounts = buildPersonalSwitcherAccounts(props.switcherAccounts);

  const sidebarNavConfig = parsePersonalAccountNavigationConfig(
    buildPersonalHomeNavRoutes(),
  );

  return (
    <Sidebar collapsible={collapsible} className={workspaceSidebarClassName}>
      <SidebarHeader className="gap-3 border-b border-[color:var(--workspace-shell-border)] px-3 py-3">
        <HomeSidebarLogo />
        <If condition={featureFlagsConfig.enableTeamAccounts}>
          <WorkspaceAccountsSelector
            selectedAccount={PERSONAL_WORKSPACE_VALUE}
            userId={user.id}
            accounts={switcherAccounts}
            className="w-full px-0"
            enableTeamCreation={featureFlagsConfig.enableTeamCreation}
          />
        </If>
      </SidebarHeader>

      <SidebarContent className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        <SidebarNavigation config={sidebarNavConfig} />
        <PersonalWorkspaceNav workspaces={sharedWorkspaces} />
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-[color:var(--workspace-shell-border)] px-2 py-3">
        <div className="flex justify-center">
          <SidebarTrigger className="h-8 w-8 rounded-md border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]/80 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]" />
        </div>
        <PersonalSettingsNavLink />
      </SidebarFooter>
    </Sidebar>
  );
}

function HomeSidebarLogo() {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;

  return (
    <KeelSidebarLogo
      href={getExplicitPersonalHomePath()}
      collapsed={collapsed}
    />
  );
}

function PersonalSettingsNavLink() {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;
  const Icon = PersonalSettingsIcon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip="Settings"
          className={cn('h-10', collapsed && 'justify-center')}
        >
          <Link href={personalAccountSettingsPath}>
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Personal settings</span> : null}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
