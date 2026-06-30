'use client';

import { useContext } from 'react';

import { JWTUserData } from '@kit/supabase/types';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarContext,
} from '@kit/ui/shadcn-sidebar';

import { KeelSidebarLogo } from '~/components/workspace-shell/keel-sidebar-logo';
import { workspaceSidebarClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

import { TeamAccountAccountsSelector } from '../_components/team-account-accounts-selector';
import { TeamAccountLayoutSidebarNavigation } from './team-account-layout-sidebar-navigation';

type TeamAccountAccessSource = {
  permissions?: string[] | null;
  role?: string | null;
  company_role?: string | null;
};

export function TeamAccountLayoutSidebar(props: {
  account: string;
  accountId: string;
  accounts: WorkspaceSwitcherAccount[];
  user: JWTUserData;
  accountAccess?: TeamAccountAccessSource;
  moduleSettings?: Record<string, boolean>;
  workspaceProfile: WorkspaceProfile;
  navCounts?: WorkNavCounts;
}) {
  const config = getTeamAccountSidebarConfig(
    props.account,
    props.accountAccess,
    props.moduleSettings,
    props.workspaceProfile,
    props.navCounts,
  );

  return (
    <Sidebar collapsible={config.sidebarCollapsedStyle} className={workspaceSidebarClassName}>
      <SidebarHeader className="gap-3 border-b border-[color:var(--workspace-shell-border)] px-3 py-3">
        <SidebarLogoLink account={props.account} />
        <TeamAccountAccountsSelector
          userId={props.user.id}
          selectedAccount={props.account}
          accounts={props.accounts}
          className="w-full px-0"
        />
      </SidebarHeader>

      <SidebarContent className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        <TeamAccountLayoutSidebarNavigation config={config} />
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-[color:var(--workspace-shell-border)] px-2 py-3">
        <div className="flex justify-center">
          <SidebarTrigger className="h-8 w-8 rounded-md border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]/80 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarLogoLink(props: { account: string }) {
  const ctx = useContext(SidebarContext);
  const collapsed = ctx ? !ctx.open : false;
  const href = pathsConfig.app.accountHome.replace('[account]', props.account);

  return (
    <KeelSidebarLogo href={href} collapsed={collapsed} />
  );
}
