'use client';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  useWorkspaceMobileNav,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileMenu,
  type MobileNavLink,
} from '~/components/workspace-shell/workspace-mobile-nav';
import { WorkspaceMobileTopActions } from '~/components/workspace-shell/workspace-top-bar-actions';
import pathsConfig from '~/config/paths.config';
import type { UserWorkspace } from '../_lib/server/load-user-workspace';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

type PersonalHomeMobileChromeProps = {
  workspace: UserWorkspace;
  navLinks: MobileNavLink[];
  switcherAccounts: WorkspaceSwitcherAccount[];
  children: React.ReactNode;
};

export function PersonalHomeMobileChrome({
  workspace,
  navLinks,
  switcherAccounts,
  children,
}: PersonalHomeMobileChromeProps) {
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();
  const homePath = pathsConfig.app.home;
  const userId = workspace.user.id;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:flex">
        <WorkspaceMobileHeaderBar>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            Personal
          </p>
          <WorkspaceMobileTopActions
            variant="personal"
            userId={userId}
            accountId={workspace.workspace?.id}
          />
          <ProfileAccountDropdownContainer
            user={workspace.user}
            account={workspace.workspace}
            showProfileName={false}
            className="shrink-0"
          />
        </WorkspaceMobileHeaderBar>

        <PullToRefresh className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </PullToRefresh>
      </div>

      <WorkspaceMobileMenu
        account=""
        userId={userId}
        accounts={switcherAccounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />

      <WorkspaceMobileBottomNav
        account=""
        homePath={homePath}
        navLinks={navLinks}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
    </>
  );
}
