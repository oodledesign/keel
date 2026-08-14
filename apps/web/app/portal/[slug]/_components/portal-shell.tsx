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
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';

import pathsConfig from '~/config/paths.config';

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
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return trimmed.split('?')[0] || trimmed;
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
  showMessagesNav = false,
  children,
}: {
  clientSlug: string;
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
  showMessagesNav?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const visibility: Record<string, boolean> = {
    showWebsiteNav,
    showProjectsNav,
    showMessagesNav,
  };

  const clientLogo = normalizeLogoUrl(clientPictureUrl);
  const agencyLogo = normalizeLogoUrl(accountLogoUrl);
  const agencyName = accountName?.trim() || 'Agency';

  // Client logo is primary when present; agency logo only as a badge when both
  // exist and are different. Never show the agency mark twice.
  const primaryLogo = clientLogo ?? agencyLogo;
  const primaryLabel = clientLogo ? orgName : agencyName;
  const secondaryLogo =
    clientLogo && agencyLogo && agencyLogo !== clientLogo ? agencyLogo : null;

  return (
    <div className="min-h-screen bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)]">
      <header className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <PortalBrandMark
                  src={primaryLogo}
                  label={primaryLabel}
                  sizeClass="size-12"
                />
                {secondaryLogo ? (
                  <div className="absolute -right-1 -bottom-1">
                    <PortalBrandMark
                      src={secondaryLogo}
                      label={agencyName}
                      sizeClass="size-7"
                    />
                  </div>
                ) : null}
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

          <nav className="flex flex-wrap gap-1">
            {navItems
              .filter((item) => !item.showKey || visibility[item.showKey])
              .map((item) => {
                const href = createPortalPath(item.pathKey, clientSlug);
                const active = isNavActive(pathname, href, item.key);

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                        : 'text-[var(--workspace-shell-nav-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-nav-text-hover)]'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <PortalSupportFab clientSlug={clientSlug} />
    </div>
  );
}
