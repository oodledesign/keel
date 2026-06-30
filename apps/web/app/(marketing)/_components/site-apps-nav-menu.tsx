'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from '@kit/ui/navigation-menu';
import { cn, isRouteActive } from '@kit/ui/utils';

import { listAppLandingSummaries } from '~/lib/marketing/app-landing-pages';
import {
  marketingNavDropdownDesc,
  marketingNavDropdownItem,
  marketingNavDropdownTitle,
  marketingNavLinkActive,
  marketingNavTrigger,
} from '~/lib/marketing/marketing-ui';

import {
  marketingNavPanelClass,
  marketingNavScrollClass,
} from './site-marketing-nav-styles';

const apps = listAppLandingSummaries();

function appsNavActive(pathname: string) {
  return pathname === '/apps' || pathname.startsWith('/apps/');
}

export function SiteAppsNavMenu() {
  const pathname = usePathname();
  const active = appsNavActive(pathname);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(marketingNavTrigger, active && marketingNavLinkActive)}
      >
        Apps
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div
          className={cn(
            'grid w-[min(100vw-2rem,22rem)] gap-1 p-2',
            marketingNavPanelClass,
            marketingNavScrollClass,
          )}
        >
          <Link href="/apps" className={cn(marketingNavDropdownItem, 'block')}>
            <span className={marketingNavDropdownTitle}>All Ozer apps</span>
            <span className={marketingNavDropdownDesc}>
              Overview of every workspace add-on
            </span>
          </Link>
          <div className="my-1 border-t border-[color:var(--workspace-shell-border)]" />
          {apps.map((app) => {
            const Icon = app.icon;
            const href = `/apps/${app.slug}`;
            const itemActive = pathname === href;

            return (
              <Link
                key={app.slug}
                href={href}
                className={cn(
                  marketingNavDropdownItem,
                  itemActive && 'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={marketingNavDropdownTitle}>{app.name}</span>
                  <span className={marketingNavDropdownDesc}>{app.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
