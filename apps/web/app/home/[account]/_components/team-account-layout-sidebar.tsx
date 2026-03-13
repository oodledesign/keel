import { JWTUserData } from '@kit/supabase/types';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from '@kit/ui/shadcn-sidebar';

import { ProfileAccountDropdownContainer } from '~/components//personal-account-dropdown-container';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';

import { TeamAccountAccountsSelector } from '../_components/team-account-accounts-selector';
import { TeamAccountLayoutSidebarNavigation } from './team-account-layout-sidebar-navigation';

type AccountModel = {
  label: string | null;
  value: string | null;
  image: string | null;
};

type TeamAccountAccessSource = {
  permissions?: string[] | null;
  role?: string | null;
  company_role?: string | null;
};

export function TeamAccountLayoutSidebar(props: {
  account: string;
  accountId: string;
  accounts: AccountModel[];
  user: JWTUserData;
  accountAccess?: TeamAccountAccessSource;
}) {
  return (
    <SidebarContainer
      account={props.account}
      accountId={props.accountId}
      accounts={props.accounts}
      user={props.user}
      accountAccess={props.accountAccess}
    />
  );
}

function SidebarContainer(props: {
  account: string;
  accountId: string;
  accounts: AccountModel[];
  user: JWTUserData;
  accountAccess?: TeamAccountAccessSource;
}) {
  const { account, accounts, user, accountAccess } = props;
  const userId = user.id;

  const config = getTeamAccountSidebarConfig(account, accountAccess);
  const collapsible = config.sidebarCollapsedStyle;

  return (
    <Sidebar
      collapsible={collapsible}
      className="bg-[var(--workspace-shell-sidebar)] text-[var(--workspace-shell-text)] [--sidebar-background:var(--workspace-shell-sidebar)] [--sidebar-foreground:var(--workspace-shell-text)] [--sidebar-accent:var(--workspace-shell-sidebar-accent)] [--sidebar-accent-foreground:#ffffff] [--sidebar-border:rgba(255,255,255,0.08)] [&_[data-sidebar=sidebar]]:bg-[var(--workspace-shell-sidebar)] [&_[data-sidebar=sidebar]]:text-[var(--workspace-shell-text)] [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-white/6 [&_[data-sidebar=menu-button]]:h-11 [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:px-3 [&_[data-sidebar=menu-button]]:text-[0.95rem] [&_[data-sidebar=menu-button][data-active=true]]:bg-[var(--workspace-shell-sidebar-active)] [&_[data-sidebar=menu-button][data-active=true]]:text-white [&_[data-sidebar=menu-button]]:text-[var(--workspace-shell-text)] [&_[data-sidebar=menu-button]:hover]:bg-[var(--workspace-shell-sidebar-active)] [&_[data-sidebar=menu-button]:hover]:text-white"
    >
      <SidebarHeader className="h-20 justify-center border-b border-white/6 px-3">
        <div className="flex items-center justify-between gap-x-3">
          <TeamAccountAccountsSelector
            userId={userId}
            selectedAccount={account}
            accounts={accounts}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className={`mt-4 h-[calc(100%-180px)] overflow-y-auto px-2 pb-4`}>
        <TeamAccountLayoutSidebarNavigation config={config} />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/6 px-2 py-3">
        <div className="mb-2 flex items-center justify-center">
          <SidebarTrigger className="h-8 w-8 rounded-md border border-white/12 bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-active)]" />
        </div>
        <SidebarContent>
          <ProfileAccountDropdownContainer user={props.user} />
        </SidebarContent>
      </SidebarFooter>
    </Sidebar>
  );
}
