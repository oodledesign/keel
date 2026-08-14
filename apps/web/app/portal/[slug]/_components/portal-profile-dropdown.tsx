'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  BookOpen,
  CreditCard,
  Home,
  LogOut,
  Settings,
} from 'lucide-react';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { PortalCreditsMenuMeter } from './portal-credits-menu-meter';

const MENU_PANEL_CLASS =
  'w-[min(21.6rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] shadow-[0_16px_48px_rgba(53,30,40,0.18)] outline-none ring-0';

const MENU_ITEM_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] outline-none focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)] data-[highlighted]:bg-[var(--workspace-shell-sidebar-accent)] data-[highlighted]:text-[var(--workspace-shell-text)]';

const MENU_ICON_WRAP_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';

function MenuLinkItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
      <Link href={href} className="flex w-full items-center gap-3">
        <span className={MENU_ICON_WRAP_CLASS}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

export function PortalProfileDropdown({
  clientSlug,
  displayName,
  userEmail,
  userAvatarUrl,
  creditBalance,
  creditsPerCycle,
  hasWorkspaceAccess = false,
}: {
  clientSlug: string;
  displayName: string;
  userEmail: string | null;
  userAvatarUrl?: string | null;
  creditBalance: number;
  creditsPerCycle: number | null;
  hasWorkspaceAccess?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();

  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    clientSlug,
  );
  const settingsHref = pathsConfig.app.clientPortalSettings.replace(
    '[clientSlug]',
    clientSlug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Open your profile menu"
        className="shrink-0 rounded-full p-0.5 ring-1 ring-transparent transition-[box-shadow,opacity] outline-none hover:opacity-95 hover:ring-[color:var(--workspace-shell-border)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/40"
      >
        <ProfileAvatar
          displayName={displayName || userEmail || 'You'}
          pictureUrl={userAvatarUrl}
          className="size-9"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={MENU_PANEL_CLASS}>
        <div className="px-4 pt-4 pb-3">
          <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
            {displayName || 'Account'}
          </p>
          {userEmail ? (
            <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
              {userEmail}
            </p>
          ) : null}
        </div>

        <PortalCreditsMenuMeter
          balance={creditBalance}
          creditsPerCycle={creditsPerCycle}
          creditsHref={creditsHref}
        />

        <div className="space-y-0.5 px-1.5 py-1.5">
          <MenuLinkItem href={billingHref} icon={CreditCard} label="Billing" />
          <MenuLinkItem href={settingsHref} icon={Settings} label="Settings" />
          <MenuLinkItem href="/docs" icon={BookOpen} label="Documentation" />
          {hasWorkspaceAccess ? (
            <MenuLinkItem
              href={pathsConfig.app.home}
              icon={Home}
              label="Back to Ozer"
            />
          ) : null}
        </div>

        <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />

        <div className="px-1.5 py-1.5">
          <DropdownMenuItem
            className={cn(MENU_ITEM_CLASS, 'text-[var(--ozer-accent)]')}
            onSelect={(event) => {
              event.preventDefault();
              void signOut.mutateAsync();
            }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="truncate">Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
