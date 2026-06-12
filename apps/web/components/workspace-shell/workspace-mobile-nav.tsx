'use client';

import { useCallback, useMemo, useState } from 'react';

import { usePathname } from 'next/navigation';

import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { HapticButton, HapticLink } from '~/components/haptic-link';
import { WorkspaceAccountsSelector } from '~/components/workspace-shell/workspace-accounts-selector';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import { triggerHapticFeedback } from '~/lib/haptics';

export type MobileNavLink = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

function navShortLabel(label: string) {
  const raw = label.includes(':') ? (label.split(':').pop() ?? label) : label;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type WorkspaceMobileMenuProps = {
  account: string;
  userId: string;
  accounts: WorkspaceSwitcherAccount[];
  navLinks: MobileNavLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WorkspaceMobileMenu({
  account,
  userId,
  accounts,
  navLinks,
  open,
  onOpenChange,
}: WorkspaceMobileMenuProps) {
  const signOut = useSignOut();
  const pathname = usePathname();

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSignOut = async () => {
    triggerHapticFeedback();
    await signOut.mutateAsync();
    close();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--workspace-shell-header)] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <p className="text-base font-semibold text-white">Menu</p>
        <HapticButton
          type="button"
          aria-label="Close menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-white/8"
          onClick={close}
        >
          <X className="h-5 w-5" />
        </HapticButton>
      </div>

      <div className="border-b border-white/8 px-4 py-4">
        <WorkspaceAccountsSelector
          selectedAccount={account}
          userId={userId}
          accounts={accounts}
          className="w-full max-w-none justify-between px-0"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navLinks.map((item) => {
            const active =
              pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(`${item.path}/`));

            return (
              <li key={item.path}>
                <HapticLink
                  href={item.path}
                  onClick={close}
                  className={cn(
                    'flex min-h-[3.25rem] items-center gap-4 rounded-xl px-4 py-3 text-[1.05rem] font-medium transition-colors',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-200 hover:bg-white/6',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                    {item.Icon}
                  </span>
                  <Trans i18nKey={item.label} defaults={item.label} />
                </HapticLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/8 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <HapticLink
          href={pathsConfig.app.personalAccountSettings}
          onClick={close}
          className="flex min-h-[3.25rem] items-center gap-4 rounded-xl px-4 py-3 text-[1.05rem] font-medium text-zinc-200 hover:bg-white/6"
        >
          Settings
        </HapticLink>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-[3.25rem] w-full items-center gap-4 rounded-xl px-4 py-3 text-[1.05rem] font-medium text-zinc-200 hover:bg-white/6"
        >
          <LogOut className="h-5 w-5" />
          <Trans i18nKey="common:signOut" defaults="Sign out" />
        </button>
      </div>
    </div>
  );
}

type WorkspaceMobileBottomNavProps = {
  account: string;
  homePath: string;
  navLinks: MobileNavLink[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
};

export function WorkspaceMobileBottomNav({
  homePath,
  navLinks,
  menuOpen,
  onMenuOpenChange,
}: WorkspaceMobileBottomNavProps) {
  const pathname = usePathname();

  const tabs = useMemo(() => {
    const withoutHome = navLinks.filter((l) => l.path !== homePath);
    const primary = withoutHome.slice(0, 2);
    const homeLink = navLinks.find((l) => l.path === homePath);
    return [
      {
        path: homePath,
        label: 'Home',
        Icon: homeLink?.Icon ?? <LayoutDashboard className="h-5 w-5" />,
      },
      ...primary,
    ];
  }, [navLinks, homePath]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[var(--workspace-shell-header)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const active =
            pathname === tab.path ||
            (tab.path !== homePath && pathname.startsWith(`${tab.path}/`)) ||
            (tab.path === homePath &&
              (pathname === homePath || pathname === `${homePath}/`));

          return (
            <HapticLink
              key={tab.path}
              href={tab.path}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium',
                active ? 'text-[#5eead4]' : 'text-zinc-400',
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                {tab.Icon}
              </span>
              <span className="truncate">
                {tab.label === 'Home' ? (
                  'Home'
                ) : (
                  <Trans
                    i18nKey={tab.label}
                    defaults={navShortLabel(tab.label)}
                  />
                )}
              </span>
            </HapticLink>
          );
        })}

        <HapticButton
          type="button"
          aria-expanded={menuOpen}
          aria-label="Open menu"
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium',
            menuOpen ? 'text-[#5eead4]' : 'text-zinc-400',
          )}
          onClick={() => onMenuOpenChange(!menuOpen)}
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </HapticButton>
      </div>
    </nav>
  );
}

export function useWorkspaceMobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return { menuOpen, setMenuOpen };
}

/** Compact mobile header row: workspace selector + notifications slot + avatar slot */
export function WorkspaceMobileHeaderBar({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-white/8 bg-[var(--workspace-shell-header)] px-3 lg:hidden',
        className,
      )}
    >
      {children}
    </header>
  );
}

export function WorkspaceMobileHeaderSelector(props: {
  account: string;
  userId: string;
  accounts: WorkspaceSwitcherAccount[];
}) {
  return (
    <div className="min-w-0 flex-1">
      <WorkspaceAccountsSelector
        selectedAccount={props.account}
        userId={props.userId}
        accounts={props.accounts}
        className="h-9 max-w-none justify-start px-1"
        enableTeamCreation={false}
      />
    </div>
  );
}
