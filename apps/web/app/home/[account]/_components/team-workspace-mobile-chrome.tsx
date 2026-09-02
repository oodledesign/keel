'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import type { JWTUserData } from '@kit/supabase/types';

import { MobileTapHaptics } from '~/components/mobile-tap-haptics';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PullToRefresh } from '~/components/pull-to-refresh';
import {
  type WorkspaceSwitcherPortal,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import { WorkspaceCreateMeetingHost } from '~/components/workspace-shell/workspace-create-meeting-host';
import { WorkspaceCreateTaskHost } from '~/components/workspace-shell/workspace-create-task-host';
import { WorkspaceHelpButton } from '~/components/workspace-shell/workspace-help-button';
import {
  type MobileNavLink,
  type MobileNavSection,
  WorkspaceMobileBottomNav,
  WorkspaceMobileHeaderBar,
  WorkspaceMobileHeaderSelector,
  WorkspaceMobileMenu,
  useWorkspaceMobileNav,
} from '~/components/workspace-shell/workspace-mobile-nav';
import { useTeamAccountWorkspace } from '@kit/team-accounts/hooks/use-team-account-workspace';

import { WorkspaceMobileNewMenu } from '~/components/workspace-shell/workspace-new-menu';
import { WorkspaceMobileTopActions } from '~/components/workspace-shell/workspace-top-bar-actions';
import pathsConfig from '~/config/paths.config';
import type { CreateTaskWorkspaceChoice } from '~/home/(user)/_components/dashboard/add-task-dialog';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import { isEmailRoute } from '~/lib/pwa/is-email-route';
import { isNoteEditorRoute } from '~/lib/pwa/is-note-editor-route';
import { syncPullToRefreshPathname } from '~/lib/pwa/pull-to-refresh-context';
import { WorkspaceMobileScrollLock } from '~/lib/pwa/workspace-mobile-scroll-lock';

type TeamWorkspaceMobileChromeProps = {
  account: string;
  accountId: string;
  user: JWTUserData;
  accounts: WorkspaceSwitcherAccount[];
  portals?: WorkspaceSwitcherPortal[];
  navLinks?: MobileNavLink[];
  navSections?: MobileNavSection[];
  bottomNavTabs: MobileBottomNavTab[];
  spaceType: WorkspaceSpaceType;
  showNewMenu?: boolean;
  /** Optional floating SOP assist tracker (desktop FAB stack). */
  sopTracker?: React.ReactNode;
  children: React.ReactNode;
};

export function TeamWorkspaceMobileChrome({
  account,
  accountId,
  user,
  accounts: rawAccounts,
  portals = [],
  navLinks,
  navSections,
  bottomNavTabs,
  spaceType,
  showNewMenu = true,
  sopTracker,
  children,
}: TeamWorkspaceMobileChromeProps) {
  const workspace = useTeamAccountWorkspace();
  const canMutateCommercial =
    (workspace as { canMutateCommercial?: boolean }).canMutateCommercial ?? true;
  const pathname = usePathname();
  const noteEditorScroll = isNoteEditorRoute(pathname);
  const emailScroll = isEmailRoute(pathname);
  const fullHeightPageScroll = noteEditorScroll || emailScroll;
  const { menuOpen, setMenuOpen } = useWorkspaceMobileNav();

  useEffect(() => {
    syncPullToRefreshPathname(pathname);
  }, [pathname]);
  const homePath = pathsConfig.app.accountHome.replace('[account]', account);
  const accounts = buildPersonalSwitcherAccounts(rawAccounts);
  const settingsHref = pathsConfig.app.accountSettings.replace(
    '[account]',
    account,
  );
  const workspaceChoices: CreateTaskWorkspaceChoice[] = rawAccounts.map(
    (row) => ({
      id: row.id,
      name: row.label,
      slug: row.slug,
    }),
  );

  return (
    <>
      <MobileTapHaptics />
      {!noteEditorScroll ? <WorkspaceMobileScrollLock /> : null}
      <div
        data-team-workspace-shell
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <WorkspaceMobileHeaderBar>
          <WorkspaceMobileHeaderSelector
            account={account}
            userId={user.id}
            accounts={accounts}
            portals={portals}
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
            billingAccountId={accountId}
            billingHref={toHomeBillingHref(
              pathsConfig.app.accountBilling,
              account,
            )}
          />
        </WorkspaceMobileHeaderBar>

        {fullHeightPageScroll ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pb-0">
            {children}
          </div>
        ) : (
          <PullToRefresh className="min-w-0 lg:pb-0">{children}</PullToRefresh>
        )}
      </div>

      <WorkspaceMobileMenu
        account={account}
        userId={user.id}
        accounts={accounts}
        portals={portals}
        navLinks={navLinks}
        navSections={navSections}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="team"
        helpDefaultAccountId={accountId}
      />

      {noteEditorScroll ? null : (
        <WorkspaceMobileBottomNav
          homePath={homePath}
          bottomNavTabs={bottomNavTabs}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          settingsHref={settingsHref}
          settingsLabel="Workspace settings"
          newMenu={
            showNewMenu ? (
              <WorkspaceMobileNewMenu
                variant="team"
                account={account}
                spaceType={spaceType}
                canMutateCommercial={canMutateCommercial}
              />
            ) : null
          }
        />
      )}

      <WorkspaceCreateTaskHost
        accountId={accountId}
        accountSlug={account}
        workspaceChoices={workspaceChoices}
      />
      <WorkspaceCreateMeetingHost accountId={accountId} accountSlug={account} />
      {sopTracker}
      {/* Desktop-only floating help; mobile support lives in the hamburger menu. */}
      <WorkspaceHelpButton defaultAccountId={accountId} />
    </>
  );
}
