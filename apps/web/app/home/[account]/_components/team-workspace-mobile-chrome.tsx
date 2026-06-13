'use client';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import {
  useWorkspaceMobileNav,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileHeaderSelector,
  WorkspaceMobileMenu,
  type MobileNavLink,
} from '~/components/workspace-shell/workspace-mobile-nav';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { WorkspaceMobileTopActions } from '~/components/workspace-shell/workspace-top-bar-actions';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import type { JWTUserData } from '@kit/supabase/types';

type TeamWorkspaceMobileChromeProps = {
  account: string;
  accountId: string;
  user: JWTUserData;
  accounts: WorkspaceSwitcherAccount[];
  navLinks: MobileNavLink[];
  bottomNavTabs: MobileBottomNavTab[];
  spaceType: WorkspaceSpaceType;
  showNewMenu?: boolean;
  children: React.ReactNode;
};

export function TeamWorkspaceMobileChrome({
  account,
  accountId,
  user,
  accounts: rawAccounts,
  navLinks,
  bottomNavTabs,
  spaceType,
  showNewMenu,
  children,
}: TeamWorkspaceMobileChromeProps) {
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const accounts = buildPersonalSwitcherAccounts(rawAccounts);

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceMobileHeaderBar>
          <WorkspaceMobileHeaderSelector
            account={account}
            userId={user.id}
            accounts={accounts}
          />
          <WorkspaceMobileTopActions
            variant="team"
            userId={user.id}
            accountId={accountId}
            accountSlug={account}
            spaceType={spaceType}
            showNewMenu={showNewMenu}
          />
          <ProfileAccountDropdownContainer
          user={user}
          account={undefined}
          showProfileName={false}
          className="shrink-0"
        />
        </WorkspaceMobileHeaderBar>

        <PullToRefresh className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </PullToRefresh>
      </div>

      <WorkspaceMobileMenu
        account={account}
        userId={user.id}
        accounts={accounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />

      <WorkspaceMobileBottomNav
        homePath={homePath}
        bottomNavTabs={bottomNavTabs}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
    </>
  );
}
