'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Briefcase,
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
} from 'lucide-react';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

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
    key: 'messages',
    label: 'Messages',
    pathKey: 'clientPortalMessages' as const,
    icon: <MessageSquare className={iconClasses} />,
    showKey: 'showMessagesNav' as const,
  },
  {
    key: 'support',
    label: 'Support',
    pathKey: 'clientPortalSupport' as const,
    icon: <LifeBuoy className={iconClasses} />,
  },
  {
    key: 'billing',
    label: 'Billing',
    pathKey: 'clientPortalBilling' as const,
    icon: <CreditCard className={iconClasses} />,
  },
  {
    key: 'settings',
    label: 'Settings',
    pathKey: 'clientPortalSettings' as const,
    icon: <Settings className={iconClasses} />,
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

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  clientSlug,
  orgName,
  userEmail,
  userAvatarUrl,
  showWebsiteNav = true,
  showProjectsNav = false,
  showMessagesNav = false,
  children,
}: {
  clientSlug: string;
  orgName: string;
  userEmail: string | null;
  userAvatarUrl?: string | null;
  showWebsiteNav?: boolean;
  showProjectsNav?: boolean;
  showMessagesNav?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const signOut = useSignOut();

  const visibility: Record<string, boolean> = {
    showWebsiteNav,
    showProjectsNav,
    showMessagesNav,
  };

  return (
    <div className="min-h-screen bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)]">
      <header className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                Client portal
              </p>
              <h1 className="font-[family-name:var(--ozer-font-display)] text-lg font-semibold text-[var(--workspace-shell-text)]">
                {orgName}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {userEmail ? (
                <span className="hidden items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)] sm:flex">
                  {userAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userAvatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : null}
                  {userEmail}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => signOut.mutateAsync()}
              >
                Sign out
              </Button>
            </div>
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
    </div>
  );
}
