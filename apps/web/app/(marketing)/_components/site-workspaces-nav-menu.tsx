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
  getMarketingWorkspaceNavLinks,
  isWorkspaceNavPath,
} from '~/lib/marketing/segment-landing-pages';

const workspaces = getMarketingWorkspaceNavLinks();

export function SiteWorkspacesNavMenu() {
  const pathname = usePathname();
  const active = isWorkspaceNavPath(pathname);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          'inline-flex h-auto w-max rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300',
          'bg-transparent hover:bg-violet-500/10 hover:text-violet-50 focus:bg-violet-500/10 data-[state=open]:bg-violet-500/15',
          active
            ? 'bg-violet-500/15 text-violet-50'
            : 'text-violet-100/75',
        )}
      >
        Workspaces
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="grid w-[min(100vw-2rem,22rem)] gap-1 border-violet-200/20 bg-[#100d1f]/98 p-2 md:w-[22rem]">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            const itemActive = pathname === workspace.path;

            return (
              <Link
                key={workspace.slug}
                href={workspace.path}
                className={cn(
                  'flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-violet-500/15',
                  itemActive && 'bg-violet-500/10',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#2A9D8F]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-violet-50">
                    {workspace.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-violet-200/70">
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
