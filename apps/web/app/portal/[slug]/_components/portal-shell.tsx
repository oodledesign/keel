'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Briefcase,
  CheckSquare,
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Mic,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { PortalPaymentNotice } from '~/lib/billing/portal-payment-notice';

import { PortalPaymentNoticeBar } from './portal-payment-notice-bar';
import { PortalProfileDropdown } from './portal-profile-dropdown';
import { PortalSupportFab } from './portal-support-fab';

const iconClasses = 'w-4 h-4';

const navItems = [
  {
    key: 'overview',
    label: 'Overview',
    pathKey: 'clientPortalHome' as const,
    icon: <LayoutDashboard className={iconClasses} />,
  },
  {
    key: 'website',
    label: 'Website',
    pathKey: 'clientPortalWebsite' as const,
    icon: <Globe className={iconClasses} />,
    showKey: 'showWebsiteNav' as const,
  },
  {
    key: 'projects',
    label: 'Projects',
    pathKey: 'clientPortalProjects' as const,
    icon: <Briefcase className={iconClasses} />,
    showKey: 'showProjectsNav' as const,
  },
  {
    key: 'meetings',
    label: 'Meetings',
    pathKey: 'clientPortalMeetings' as const,
    icon: <Mic className={iconClasses} />,
    showKey: 'showMeetingsNav' as const,
  },
  {
    key: 'tasks',
    label: 'My tasks',
    pathKey: 'clientPortalMyTasks' as const,
    icon: <CheckSquare className={iconClasses} />,
  },
  {
    key: 'messages',
    label: 'Messages',
    pathKey: 'clientPortalMessages' as const,
    icon: <MessageSquare className={iconClasses} />,
    showKey: 'showMessagesNav' as const,
  },
  {
    key: 'services',
    label: 'Services',
    pathKey: 'clientPortalSupport' as const,
    icon: <Layers className={iconClasses} />,
  },
];

function createPortalPath(
  pathKey: keyof typeof pathsConfig.app,
  clientSlug: string,
) {
  return pathsConfig.app[pathKey].replace('[clientSlug]', clientSlug);
}

function isNavActive(pathname: string, href: string, key: string) {
  if (key === 'overview') {
    return pathname === href;
  }

  if (key === 'services') {
    // Keep Services highlighted on credits (credits lives under Services).
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.includes('/credits')
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function normalizeLogoUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function PortalBrandMark(props: {
  src: string | null;
  label: string;
  sizeClass: string;
}) {
  return (
    <Avatar
      className={`${props.sizeClass} border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]`}
    >
      {props.src ? <AvatarImage src={props.src} alt="" /> : null}
      <AvatarFallback className="text-xs font-semibold text-[var(--workspace-shell-text)]">
        {initials(props.label)}
      </AvatarFallback>
    </Avatar>
  );
}

export function PortalShell({
  clientSlug,
  clientOrgId,
  orgName,
  clientPictureUrl = null,
  accountName = null,
  accountLogoUrl = null,
  displayName,
  userEmail,
  userAvatarUrl,
  creditBalance = 0,
  creditsPerCycle = null,
  hasWorkspaceAccess = false,
  showWebsiteNav = true,
  showProjectsNav = false,
  showMeetingsNav = false,
  showMessagesNav = false,
  incompleteTaskCount = 0,
  paymentNotice = null,
  children,
}: {
  clientSlug: string;
  clientOrgId: string;
  orgName: string;
  clientPictureUrl?: string | null;
  accountName?: string | null;
  accountLogoUrl?: string | null;
  displayName: string;
  userEmail: string | null;
  userAvatarUrl?: string | null;
  creditBalance?: number;
  creditsPerCycle?: number | null;
  hasWorkspaceAccess?: boolean;
  showWebsiteNav?: boolean;
  showProjectsNav?: boolean;
  showMeetingsNav?: boolean;
  showMessagesNav?: boolean;
  incompleteTaskCount?: number;
  paymentNotice?: PortalPaymentNotice | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isProjectRoute = /\/projects(\/|$)/.test(pathname);
  // Project board/list/timeline need more than max-w-6xl (1152px). 110rem
  // (~1760px) is near-full on typical desktops without hugging the edges.
  const contentWidth = isProjectRoute ? 'max-w-[110rem]' : 'max-w-6xl';

  const visibility: Record<string, boolean> = {
    showWebsiteNav,
    showProjectsNav,
    showMeetingsNav,
    showMessagesNav,
  };

  const clientLogo = normalizeLogoUrl(clientPictureUrl);
  const businessLogo = normalizeLogoUrl(accountLogoUrl);
  const businessName = accountName?.trim() || 'Agency';
  const widthClass = cn(
    'mx-auto w-full px-4 sm:px-6 lg:px-8',
    contentWidth,
    isProjectRoute && 'xl:px-10',
  );

  return (
    <div className="min-h-screen bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)]">
      {paymentNotice ? (
        <div className="sticky top-0 z-40">
          <PortalPaymentNoticeBar
            notice={paymentNotice}
            clientOrgId={clientOrgId}
            clientSlug={clientSlug}
            contentClassName={widthClass}
          />
        </div>
      ) : null}
      <header className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className={cn('flex w-full flex-col gap-4 py-4', widthClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <PortalBrandMark
                  src={businessLogo}
                  label={businessName}
                  sizeClass="size-12"
                />
                <div className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-[var(--workspace-shell-panel)]">
                  <PortalBrandMark
                    src={clientLogo}
                    label={orgName}
                    sizeClass="size-6"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Client portal
                </p>
                <h1 className="truncate font-[family-name:var(--ozer-font-display)] text-lg font-semibold text-[var(--workspace-shell-text)]">
                  {orgName}
                </h1>
              </div>
            </div>

            <PortalProfileDropdown
              clientSlug={clientSlug}
              displayName={displayName}
              userEmail={userEmail}
              userAvatarUrl={userAvatarUrl}
              creditBalance={creditBalance}
              creditsPerCycle={creditsPerCycle}
              hasWorkspaceAccess={hasWorkspaceAccess}
            />
          </div>

          <nav
            className="-mx-1 flex flex-nowrap gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-tour="portal-nav"
          >
            {navItems
              .filter((item) => {
                if (item.key === 'tasks') return incompleteTaskCount > 0;
                return !item.showKey || visibility[item.showKey];
              })
              .map((item) => {
                const href = createPortalPath(item.pathKey, clientSlug);
                const active = isNavActive(pathname, href, item.key);

                return (
                  <Link
                    key={item.key}
                    href={href}
                    data-tour={`portal-nav-${item.key}`}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                        : 'text-[var(--workspace-shell-nav-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-nav-text-hover)]'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                    {item.key === 'tasks' ? (
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                          active
                            ? 'bg-[var(--ozer-white)]/20 text-[var(--ozer-white)]'
                            : 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                        }`}
                      >
                        {incompleteTaskCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
          </nav>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full px-4 py-8 sm:px-6 lg:px-8',
          contentWidth,
          isProjectRoute && 'xl:px-10',
        )}
      >
        {children}
      </main>

      <PortalSupportFab clientSlug={clientSlug} />
    </div>
  );
}
