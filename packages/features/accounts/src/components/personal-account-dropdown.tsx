'use client';

import { type ReactNode, useMemo, useState } from 'react';

import Link from 'next/link';

import {
  BookOpen,
  ChevronsUpDown,
  HelpCircle,
  Home,
  LogOut,
  Settings,
  Shield,
} from 'lucide-react';

import { JWTUserData } from '@kit/supabase/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { SubMenuModeToggle } from '@kit/ui/mode-toggle';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { usePersonalAccountData } from '../hooks/use-personal-account-data';

const MENU_PANEL_CLASS =
  'w-[min(21.6rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] shadow-[0_16px_48px_rgba(53,30,40,0.18)] outline-none ring-0 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]';

const MENU_ITEM_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] outline-none focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)] data-[highlighted]:bg-[var(--workspace-shell-sidebar-accent)] data-[highlighted]:text-[var(--workspace-shell-text)]';

const MENU_ICON_WRAP_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';

function MenuLinkItem({
  href,
  icon: Icon,
  label,
  className,
  iconClassName,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <DropdownMenuItem asChild className={cn(MENU_ITEM_CLASS, className)}>
      <Link href={href} className="flex w-full items-center gap-3">
        <span className={cn(MENU_ICON_WRAP_CLASS, iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

function MenuActionItem({
  icon: Icon,
  label,
  onSelect,
  className,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  onSelect: () => void;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <DropdownMenuItem
      className={cn(MENU_ITEM_CLASS, className)}
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <span className={cn(MENU_ICON_WRAP_CLASS, iconClassName)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </DropdownMenuItem>
  );
}

export function PersonalAccountDropdown({
  className,
  user,
  signOutRequested,
  showProfileName = true,
  paths,
  features,
  account,
  menuClassName,
  menuExtras,
  onSupportClick,
}: {
  user: JWTUserData;

  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };

  signOutRequested: () => unknown;

  paths: {
    home: string;
    personalAccountSettings?: string;
    support?: string;
  };

  features: {
    enableThemeToggle: boolean;
  };

  showProfileName?: boolean;

  className?: string;
  menuClassName?: string;

  /** Rendered between the profile header and menu links (e.g. AI credit meter). */
  menuExtras?: ReactNode | ((open: boolean) => ReactNode);

  /** When set, Support opens the in-app messenger instead of navigating. */
  onSupportClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: personalAccountData } = usePersonalAccountData(
    user.id,
    account,
  );

  const signedInAsLabel = useMemo(() => {
    const email = user?.email ?? undefined;
    const phone = user?.phone ?? undefined;

    return email ?? phone;
  }, [user]);

  const displayName =
    personalAccountData?.name ?? account?.name ?? user?.email ?? '';

  const isSuperAdmin = useMemo(() => {
    const hasAdminRole = user?.app_metadata.role === 'super-admin';
    const isAal2 = user?.aal === 'aal2';

    return hasAdminRole && isAal2;
  }, [user]);

  const extras =
    typeof menuExtras === 'function' ? menuExtras(open) : menuExtras;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Open your profile menu"
        data-test={'account-dropdown-trigger'}
        className={cn(
          'group/trigger fade-in flex cursor-pointer items-center focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/40 focus-visible:outline-none',
          className ?? '',
          showProfileName
            ? 'gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] active:bg-[var(--workspace-shell-sidebar-accent)]'
            : 'shrink-0 rounded-full p-0.5 ring-1 ring-transparent transition-[box-shadow,opacity] hover:opacity-95 hover:ring-[color:var(--workspace-shell-border)]',
        )}
      >
        <ProfileAvatar
          className={cn(
            'border border-[color:var(--workspace-shell-border)] transition-colors',
            showProfileName ? 'h-9 w-9 rounded-lg' : 'h-8 w-8 rounded-full',
          )}
          fallbackClassName={cn(
            showProfileName ? 'rounded-lg' : 'rounded-full',
            'border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
          )}
          displayName={displayName ?? user?.email ?? ''}
          pictureUrl={personalAccountData?.picture_url}
        />

        <If condition={showProfileName}>
          <div
            className={
              'fade-in flex w-full min-w-0 flex-col truncate text-left group-data-[minimized=true]/sidebar:hidden'
            }
          >
            <span
              data-test={'account-dropdown-display-name'}
              className={
                'truncate text-sm font-medium text-[var(--workspace-shell-text)]'
              }
            >
              {displayName}
            </span>

            <span
              data-test={'account-dropdown-email'}
              className={
                'truncate text-xs text-[var(--workspace-shell-text-muted)]'
              }
            >
              {signedInAsLabel}
            </span>
          </div>

          <ChevronsUpDown
            className={
              'mr-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)] group-data-[minimized=true]/sidebar:hidden'
            }
          />
        </If>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(MENU_PANEL_CLASS, menuClassName)}
      >
        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              className="h-10 w-10 rounded-xl border border-[color:var(--workspace-shell-border)]"
              fallbackClassName="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              displayName={displayName ?? user?.email ?? ''}
              pictureUrl={personalAccountData?.picture_url}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                {signedInAsLabel}
              </p>
            </div>
          </div>
        </div>

        {extras}

        <div className="space-y-0.5 px-1.5 py-1.5">
          <MenuLinkItem
            href={paths.home}
            icon={Home}
            label={<Trans i18nKey={'common:routes.home'} />}
          />

          {paths.personalAccountSettings ? (
            <MenuLinkItem
              href={paths.personalAccountSettings}
              icon={Settings}
              label={<Trans i18nKey={'common:personalSettings'} />}
            />
          ) : null}

          {paths.support ? (
            onSupportClick ? (
              <MenuActionItem
                icon={HelpCircle}
                label={<Trans i18nKey={'common:support'} />}
                onSelect={() => {
                  setOpen(false);
                  onSupportClick();
                }}
              />
            ) : (
              <MenuLinkItem
                href={paths.support}
                icon={HelpCircle}
                label={<Trans i18nKey={'common:support'} />}
              />
            )
          ) : null}

          <MenuLinkItem
            href={'/docs'}
            icon={BookOpen}
            label={<Trans i18nKey={'common:documentation'} />}
          />
        </div>

        <If condition={isSuperAdmin}>
          <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />

          <div className="space-y-0.5 px-1.5 py-1.5">
            <MenuLinkItem
              href={'/admin'}
              icon={Shield}
              label="Super Admin"
              className="text-[var(--ozer-accent)] focus:text-[var(--ozer-accent)] data-[highlighted]:text-[var(--ozer-accent)]"
              iconClassName="bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]"
            />
          </div>
        </If>

        <If condition={features.enableThemeToggle}>
          <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />
          <div className="px-1.5 py-1">
            <SubMenuModeToggle />
          </div>
        </If>

        <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />

        <div className="space-y-0.5 px-1.5 pt-0.5 pb-1.5">
          <DropdownMenuItem
            data-test={'account-dropdown-sign-out'}
            role={'button'}
            className={cn(
              MENU_ITEM_CLASS,
              'text-[#C45B6B] focus:text-[#C45B6B] data-[highlighted]:text-[#C45B6B]',
            )}
            onClick={signOutRequested}
          >
            <span
              className={cn(
                MENU_ICON_WRAP_CLASS,
                'bg-rose-500/10 text-[#C45B6B]',
              )}
            >
              <LogOut className="h-4 w-4" />
            </span>
            <span>
              <Trans i18nKey={'auth:signOut'} />
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
