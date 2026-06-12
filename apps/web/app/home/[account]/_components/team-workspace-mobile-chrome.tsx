'use client';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import {
  useWorkspaceMobileNav,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileHeaderSelector,
  WorkspaceMobileMenu,
  type MobileNavLink,
} from '~/components/workspace-shell/workspace-mobile-nav';
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
  spaceType: WorkspaceSpaceType;
  showNewMenu?: boolean;
  children: React.ReactNode;
};

export function TeamWorkspaceMobileChrome({
  account,
  accountId,
  user,
  accounts,
  navLinks,
  spaceType,
  showNewMenu,
  children,
}: TeamWorkspaceMobileChromeProps) {
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);

  return (
    <>
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
        <ProfileAccountDropdownContainer user={user} account={undefined} />
      </WorkspaceMobileHeaderBar>

      <WorkspaceMobileMenu
        account={account}
        userId={user.id}
        accounts={accounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />

      <div className="pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>

      <WorkspaceMobileBottomNav
        account={account}
        homePath={homePath}
        navLinks={navLinks}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
    </>
  );
}
