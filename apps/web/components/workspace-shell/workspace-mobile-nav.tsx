'use client';

import { useCallback, useEffect, useState } from 'react';

import { usePathname } from 'next/navigation';

import { LogOut, Menu, X } from 'lucide-react';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { HapticButton, HapticLink } from '~/components/haptic-link';
import { WorkspaceAccountsSelector } from '~/components/workspace-shell/workspace-accounts-selector';
import pathsConfig from '~/config/paths.config';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import { triggerHapticFeedback } from '~/lib/haptics';

export type MobileNavLink = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

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

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-[#060a12]/92 backdrop-blur-md lg:hidden"
        aria-hidden
        onClick={close}
      />

      <div
        className="fixed inset-0 z-[101] flex flex-col bg-[#0B132B] lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-base font-semibold text-white">Menu</p>
          <HapticButton
            type="button"
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10"
            onClick={close}
          >
            <X className="h-5 w-5" />
          </HapticButton>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <WorkspaceAccountsSelector
            selectedAccount={account}
            userId={userId}
            accounts={accounts}
            className="w-full max-w-none justify-between px-0"
            variant="inline"
            onNavigate={close}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 pb-28">
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

        <div className="border-t border-white/10 px-3 py-4">
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

      <HapticButton
        type="button"
        aria-label="Close menu"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-4 z-[110] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#1A2535]/98 text-[#5eead4] shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden"
        onClick={close}
      >
        <X className="h-5 w-5" />
      </HapticButton>
    </>
  );
}

type WorkspaceMobileBottomNavProps = {
  homePath: string;
  bottomNavTabs: MobileBottomNavTab[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
};

export function WorkspaceMobileBottomNav({
  homePath,
  bottomNavTabs,
  menuOpen,
  onMenuOpenChange,
}: WorkspaceMobileBottomNavProps) {
  const pathname = usePathname();

  if (menuOpen) {
    return null;
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Primary"
    >
      <div className="pointer-events-auto flex h-11 items-center gap-0.5 rounded-full border border-white/10 bg-[#1A2535]/98 px-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {bottomNavTabs.map((tab) => {
          const active =
            pathname === tab.path ||
            (tab.path !== homePath && pathname.startsWith(`${tab.path}/`)) ||
            (tab.path === homePath &&
              (pathname === homePath || pathname === `${homePath}/`));

          return (
            <HapticLink
              key={tab.path}
              href={tab.path}
              aria-label={tab.label}
              title={tab.label}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                active ? 'text-[#5eead4]' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px]">
                {tab.Icon}
              </span>
            </HapticLink>
          );
        })}

        <HapticButton
          type="button"
          aria-expanded={menuOpen}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200"
          onClick={() => onMenuOpenChange(true)}
        >
          <Menu className="h-[18px] w-[18px]" />
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
