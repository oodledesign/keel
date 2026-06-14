'use client';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  PERSONAL_WORKSPACE_VALUE,
  WorkspaceAccountsSelector,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import { WorkspaceMobileNewMenu } from '~/components/workspace-shell/workspace-new-menu';
import {
  useWorkspaceMobileNav,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileMenu,
  type MobileNavLink,
} from '~/components/workspace-shell/workspace-mobile-nav';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { WorkspaceMobileTopActions } from '~/components/workspace-shell/workspace-top-bar-actions';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import type { UserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';

type PersonalHomeMobileChromeProps = {
  workspace: UserWorkspace;
  navLinks: MobileNavLink[];
  bottomNavTabs: MobileBottomNavTab[];
  switcherAccounts: WorkspaceSwitcherAccount[];
  children: React.ReactNode;
};

export function PersonalHomeMobileChrome({
  workspace,
  navLinks,
  bottomNavTabs,
  switcherAccounts: rawSwitcherAccounts,
  children,
}: PersonalHomeMobileChromeProps) {
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();
  const homePath = pathsConfig.app.home;
  const userId = workspace.user.id;
  const switcherAccounts = buildPersonalSwitcherAccounts(rawSwitcherAccounts);

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceMobileHeaderBar>
          <div className="min-w-0 flex-1">
            <WorkspaceAccountsSelector
              selectedAccount={PERSONAL_WORKSPACE_VALUE}
              userId={userId}
              accounts={switcherAccounts}
              className="h-9 max-w-none justify-start px-1"
              enableTeamCreation={false}
            />
          </div>
          <WorkspaceMobileTopActions
            variant="personal"
            userId={userId}
            accountId={workspace.workspace?.id}
            showNewMenu={false}
          />
          <ProfileAccountDropdownContainer
            user={workspace.user}
            account={workspace.workspace}
            showProfileName={false}
            className="shrink-0"
          />
        </WorkspaceMobileHeaderBar>

        <PullToRefresh className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </PullToRefresh>
      </div>

      <WorkspaceMobileMenu
        account={PERSONAL_WORKSPACE_VALUE}
        userId={userId}
        accounts={switcherAccounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="personal"
      />

      <WorkspaceMobileBottomNav
        homePath={homePath}
        bottomNavTabs={bottomNavTabs}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        settingsHref={pathsConfig.app.personalAccountSettings}
        settingsLabel="Personal settings"
        newMenu={<WorkspaceMobileNewMenu variant="personal" />}
      />
    </>
  );
}
