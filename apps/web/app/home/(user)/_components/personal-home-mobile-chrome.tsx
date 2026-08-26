'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { MobileTapHaptics } from '~/components/mobile-tap-haptics';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  WorkspaceAccountsSelector,
  type WorkspaceSwitcherPortal,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import { WorkspaceCreateTaskHost } from '~/components/workspace-shell/workspace-create-task-host';
import {
  type MobileNavLink,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileMenu,
  useWorkspaceMobileNav,
} from '~/components/workspace-shell/workspace-mobile-nav';
import { WorkspaceMobileNewMenu } from '~/components/workspace-shell/workspace-new-menu';
import { WorkspaceMobileTopActions } from '~/components/workspace-shell/workspace-top-bar-actions';
import pathsConfig from '~/config/paths.config';
import type { UserWorkspace } from '~/home/(user)/_lib/server/load-user-workspace';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { isEmailRoute } from '~/lib/pwa/is-email-route';
import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import { syncPullToRefreshPathname } from '~/lib/pwa/pull-to-refresh-context';
import { WorkspaceMobileScrollLock } from '~/lib/pwa/workspace-mobile-scroll-lock';
import { PERSONAL_WORKSPACE_VALUE } from '~/lib/workspace-personal-switcher';

type PersonalHomeMobileChromeProps = {
  workspace: UserWorkspace;
  navLinks: MobileNavLink[];
  bottomNavTabs: MobileBottomNavTab[];
  switcherAccounts: WorkspaceSwitcherAccount[];
  switcherPortals?: WorkspaceSwitcherPortal[];
  children: React.ReactNode;
};

export function PersonalHomeMobileChrome({
  workspace,
  navLinks,
  bottomNavTabs,
  switcherAccounts: rawSwitcherAccounts,
  switcherPortals = [],
  children,
}: PersonalHomeMobileChromeProps) {
  const pathname = usePathname();
  const noteEditorScroll = isNoteEditorRoute(pathname);
  const fullHeightPageScroll =
    noteEditorScroll || isEmailRoute(pathname);
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();

  useEffect(() => {
    syncPullToRefreshPathname(pathname);
  }, [pathname]);
  const homePath = getExplicitPersonalHomePath();
  const userId = workspace.user.id;
  const switcherAccounts = buildPersonalSwitcherAccounts(rawSwitcherAccounts);

  return (
    <>
      <MobileTapHaptics />
      {!noteEditorScroll ? <WorkspaceMobileScrollLock /> : null}
      <div
        className={
          fullHeightPageScroll
            ? 'flex min-w-0 flex-1 flex-col'
            : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
        }
      >
        <WorkspaceMobileHeaderBar>
          <div className="min-w-0 flex-1">
            <WorkspaceAccountsSelector
              selectedAccount={PERSONAL_WORKSPACE_VALUE}
              userId={userId}
              accounts={switcherAccounts}
              portals={switcherPortals}
              personalAccount={
                workspace.workspace
                  ? {
                      id: workspace.workspace.id,
                      name: workspace.workspace.name,
                      picture_url: workspace.workspace.picture_url,
                    }
                  : undefined
              }
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
            billingAccountId={userId}
            billingHref={toHomeBillingHref(
              pathsConfig.app.personalAccountBilling,
            )}
          />
        </WorkspaceMobileHeaderBar>

        {fullHeightPageScroll ? (
          <div className="min-h-0 min-w-0 flex-1 lg:pb-0">{children}</div>
        ) : (
          <PullToRefresh className="min-w-0 lg:pb-0">{children}</PullToRefresh>
        )}
      </div>

      <WorkspaceMobileMenu
        account={PERSONAL_WORKSPACE_VALUE}
        userId={userId}
        accounts={switcherAccounts}
        portals={switcherPortals}
        navLinks={navLinks}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="personal"
        helpDefaultAccountId={workspace.workspace?.id ?? null}
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

      <WorkspaceCreateTaskHost lifeOnly />
    </>
  );
}
