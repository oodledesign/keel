'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Menu, Settings, X } from 'lucide-react';

import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { HapticButton, HapticLink } from '~/components/haptic-link';
import { WorkspaceAccountsSelector } from '~/components/workspace-shell/workspace-accounts-selector';
import type { MobileBottomNavTab } from '~/lib/mobile-nav/resolve-bottom-nav-tabs';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

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
  variant?: 'personal' | 'team';
};

export function WorkspaceMobileMenu({
  account,
  userId,
  accounts,
  navLinks,
  open,
  onOpenChange,
  variant = 'team',
}: WorkspaceMobileMenuProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(open);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    const timer = window.setTimeout(() => setVisible(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!visible && !open) return null;

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[100] bg-[#060a12]/92 backdrop-blur-md transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
        onClick={close}
      />

      <div
        className={cn(
          'fixed inset-0 z-[101] flex flex-col bg-[#0B132B] transition-transform duration-200 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-base font-semibold text-white">Menu</p>
          <HapticButton
            type="button"
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 hover:bg-white/8 hover:text-white"
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
            {navLinks.map((item, index) => {
              const active =
                pathname === item.path ||
                (item.path !== '/' && pathname.startsWith(`${item.path}/`));

              return (
                <li
                  key={item.path}
                  className={cn(
                    'transition-all duration-200',
                    open
                      ? 'translate-x-0 opacity-100'
                      : '-translate-x-2 opacity-0',
                  )}
                  style={{ transitionDelay: open ? `${index * 25}ms` : '0ms' }}
                >
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

        {variant === 'personal' ? (
          <div className="border-t border-white/10 px-3 py-4 lg:hidden">
            <p className="px-4 text-xs text-zinc-500">
              Personal settings are in the bottom bar while the menu is open.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

type WorkspaceMobileBottomNavProps = {
  homePath: string;
  bottomNavTabs: MobileBottomNavTab[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  settingsHref: string;
  settingsLabel: string;
  newMenu?: React.ReactNode;
};

const MOBILE_NAV_ICON_CLASS = 'h-[21px] w-[21px]';
const MOBILE_NAV_BTN_CLASS = 'flex h-10 w-10 items-center justify-center rounded-full transition-colors';

export function WorkspaceMobileBottomNav({
  homePath,
  bottomNavTabs,
  menuOpen,
  onMenuOpenChange,
  settingsHref,
  settingsLabel,
  newMenu,
}: WorkspaceMobileBottomNavProps) {
  const pathname = usePathname();

  if (menuOpen) {
    return (
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Menu controls"
      >
        <div className="pointer-events-auto flex h-14 items-center gap-3 rounded-full border border-white/10 bg-[#1A2535]/98 px-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <HapticButton
            type="button"
            aria-label="Close menu"
            className={cn(
              MOBILE_NAV_BTN_CLASS,
              'gap-2 px-4 text-sm font-medium text-zinc-200 hover:bg-white/8',
            )}
            onClick={() => onMenuOpenChange(false)}
          >
            <X className={MOBILE_NAV_ICON_CLASS} />
            <span>Close</span>
          </HapticButton>

          <HapticLink
            href={settingsHref}
            onClick={() => onMenuOpenChange(false)}
            className={cn(
              MOBILE_NAV_BTN_CLASS,
              'min-w-[5.5rem] flex-col gap-0.5 px-3 text-zinc-300 hover:bg-white/8 hover:text-white',
            )}
          >
            <Settings className={MOBILE_NAV_ICON_CLASS} />
            <span className="max-w-[7rem] truncate text-[10px] font-medium leading-none">
              {settingsLabel}
            </span>
          </HapticLink>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Primary"
    >
      <div className="pointer-events-auto flex h-12 items-center gap-0.5 rounded-full border border-white/10 bg-[#1A2535]/98 px-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
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
                MOBILE_NAV_BTN_CLASS,
                active
                  ? 'bg-[var(--keel-teal)]/15 text-[#5eead4]'
                  : 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center [&>svg]:h-[21px] [&>svg]:w-[21px]',
                )}
              >
                {tab.Icon}
              </span>
            </HapticLink>
          );
        })}

        {newMenu}

        <HapticButton
          type="button"
          aria-expanded={menuOpen}
          aria-label="Open menu"
          className={cn(
            MOBILE_NAV_BTN_CLASS,
            'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200',
          )}
          onClick={() => onMenuOpenChange(true)}
        >
          <Menu className={MOBILE_NAV_ICON_CLASS} />
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
        'z-30 flex h-12 shrink-0 items-center gap-2 border-b border-white/8 bg-[var(--workspace-shell-canvas)] px-3 lg:hidden',
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
