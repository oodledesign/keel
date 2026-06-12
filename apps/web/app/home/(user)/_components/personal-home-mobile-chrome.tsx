'use client';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
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
        />
      </WorkspaceMobileHeaderBar>

      <WorkspaceMobileMenu
        account=""
        userId={userId}
        accounts={switcherAccounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />

      <div className="pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>

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
