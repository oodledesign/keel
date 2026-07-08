'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { MobileTapHaptics } from '~/components/mobile-tap-haptics';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import {
  WorkspaceMobileNewMenu,
} from '~/components/workspace-shell/workspace-new-menu';
import {
  useWorkspaceMobileNav,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileHeaderSelector,
  WorkspaceMobileMenu,
  type MobileNavLink,
} from '~/components/workspace-shell/workspace-mobile-nav';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import {
  isWorkspaceDashboardHome,
  syncPullToRefreshPathname,
} from '~/lib/pwa/pull-to-refresh-context';
import { WorkspaceMobileScrollArea } from '~/lib/pwa/workspace-mobile-scroll-area';
import { WorkspaceMobileScrollLock } from '~/lib/pwa/workspace-mobile-scroll-lock';

import { WorkspaceCreateTaskHost } from '~/components/workspace-shell/workspace-create-task-host';
import { WorkspaceHelpButton } from '~/components/workspace-shell/workspace-help-button';
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
  showNewMenu = true,
  children,
}: TeamWorkspaceMobileChromeProps) {
  const pathname = usePathname();
  const noteEditorScroll = isNoteEditorRoute(pathname);
  const dashboardHome = isWorkspaceDashboardHome(pathname);
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();

  useEffect(() => {
    syncPullToRefreshPathname(pathname);
  }, [pathname]);
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const accounts = buildPersonalSwitcherAccounts(rawAccounts);
  const settingsHref = pathsConfig.app.accountSettings.replace('[account]', account);

  return (
    <>
      <MobileTapHaptics />
      {!noteEditorScroll ? <WorkspaceMobileScrollLock /> : null}
      <div
        data-team-workspace-shell
        className={
          noteEditorScroll
            ? 'flex min-w-0 flex-1 flex-col'
            : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
        }
      >
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
            showNewMenu={false}
          />
          <ProfileAccountDropdownContainer
            user={user}
            account={undefined}
            showProfileName={false}
            className="shrink-0"
          />
        </WorkspaceMobileHeaderBar>

        {noteEditorScroll ? (
          <div className="min-w-0 flex-1 lg:pb-0">
            {children}
          </div>
        ) : dashboardHome ? (
          <WorkspaceMobileScrollArea className="min-w-0 lg:pb-0">
            {children}
          </WorkspaceMobileScrollArea>
        ) : (
          <PullToRefresh className="min-w-0 lg:pb-0">
            {children}
          </PullToRefresh>
        )}
      </div>

      <WorkspaceMobileMenu
        account={account}
        userId={user.id}
        accounts={accounts}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="team"
      />

      <WorkspaceMobileBottomNav
        homePath={homePath}
        bottomNavTabs={bottomNavTabs}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        settingsHref={settingsHref}
        settingsLabel="Workspace settings"
        helpDefaultAccountId={accountId}
        newMenu={
          showNewMenu ? (
            <WorkspaceMobileNewMenu
              variant="team"
              account={account}
              spaceType={spaceType}
            />
          ) : null
        }
      />

      <WorkspaceCreateTaskHost accountId={accountId} accountSlug={account} />
      <WorkspaceHelpButton defaultAccountId={accountId} />
    </>
  );
}
