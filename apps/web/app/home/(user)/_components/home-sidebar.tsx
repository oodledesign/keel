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
import { workspaceSidebarClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { WorkspaceProfileBlock } from '~/components/workspace-shell/workspace-profile-block';
import featureFlagsConfig from '~/config/feature-flags.config';
import {
  buildPersonalHomeNavRoutes,
  parsePersonalAccountNavigationConfig,
  personalAccountNavigationConfig,
  personalAccountSettingsPath,
  PersonalSettingsIcon,
} from '~/config/personal-account-navigation.config';
import pathsConfig from '~/config/paths.config';

import type { UserWorkspace } from '../_lib/server/load-user-workspace';

import { HomeAccountSelector } from './home-account-selector';
import { PersonalWorkspaceNav } from './personal-workspace-nav';

interface HomeSidebarProps {
  workspace: UserWorkspace;
  /** Shared workspaces for sidebar shortcuts (from memberships). */
  sharedWorkspaces?: Array<{
    id: string;
    label: string;
    slug: string;
    pictureUrl: string | null;
  }>;
}

export function HomeSidebar(props: HomeSidebarProps) {
  const { workspace, user, accounts } = props.workspace;
  const collapsible = personalAccountNavigationConfig.sidebarCollapsedStyle;
  const teamAccounts = Array.isArray(accounts) ? accounts : [];
  const sharedWorkspaces = props.sharedWorkspaces ?? [];

  const sidebarNavConfig = parsePersonalAccountNavigationConfig(
    buildPersonalHomeNavRoutes(),
  );

  const selectorAccounts = teamAccounts.map((a) => ({
    label: a.label,
    value: a.value,
    image: a.image ?? null,
    role: null as string | null,
  }));

  return (
    <Sidebar collapsible={collapsible} className={workspaceSidebarClassName}>
      <SidebarHeader className="gap-0 border-b border-white/[0.08] px-3 py-3">
        <HomeSidebarLogo />
        <If condition={featureFlagsConfig.enableTeamAccounts}>
          <HomeAccountSelector
            userId={user.id}
            accounts={selectorAccounts}
            className="mt-1 w-full px-0"
          />
        </If>
      </SidebarHeader>

      <SidebarContent className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        <SidebarNavigation config={sidebarNavConfig} />
        <PersonalWorkspaceNav workspaces={sharedWorkspaces} />
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-white/[0.08] px-2 py-3">
        <div className="flex justify-center">
          <SidebarTrigger className="h-8 w-8 rounded-md border border-white/12 text-white/80 hover:bg-white/[0.06] hover:text-white" />
        </div>
        <PersonalSettingsNavLink />
        <WorkspaceProfileBlockWithCollapse
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

function HomeSidebarLogo() {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;

  return (
    <KeelSidebarLogo
      href={pathsConfig.app.home}
      collapsed={collapsed}
      className="max-w-[140px]"
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

function WorkspaceProfileBlockWithCollapse(props: {
  user: UserWorkspace['user'];
  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
}) {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;

  return (
    <WorkspaceProfileBlock
      user={props.user}
      account={props.account}
      collapsed={collapsed}
    />
  );
}
