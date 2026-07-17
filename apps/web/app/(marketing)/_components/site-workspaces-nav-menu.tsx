'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from '@kit/ui/navigation-menu';
import { cn } from '@kit/ui/utils';

import {
  marketingNavDropdownDesc,
  marketingNavDropdownItem,
  marketingNavDropdownTitle,
  marketingNavLinkActive,
  marketingNavTrigger,
} from '~/lib/marketing/marketing-ui';
import {
  getMarketingWorkspaceNavLinks,
  isWorkspaceNavPath,
} from '~/lib/marketing/segment-landing-pages';

import {
  marketingNavPanelClass,
  marketingNavScrollClass,
} from './site-marketing-nav-styles';

const workspaces = getMarketingWorkspaceNavLinks();

export function SiteWorkspacesNavMenu() {
  const pathname = usePathname();
  const active = isWorkspaceNavPath(pathname);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(marketingNavTrigger, active && marketingNavLinkActive)}
      >
        Workspaces
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div
          className={cn(
            'grid w-[min(100vw-2rem,22rem)] gap-1 p-2',
            marketingNavPanelClass,
            marketingNavScrollClass,
          )}
        >
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            const itemActive = pathname === workspace.path;

            return (
              <Link
                key={workspace.slug}
                href={workspace.path}
                className={cn(
                  marketingNavDropdownItem,
                  itemActive && 'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={marketingNavDropdownTitle}>
                    {workspace.label}
                  </span>
                  <span className={marketingNavDropdownDesc}>
                    {workspace.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
