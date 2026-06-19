'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from '@kit/ui/navigation-menu';
import { cn, isRouteActive } from '@kit/ui/utils';

import { FEATURE_NAV_GROUPS } from '~/lib/marketing/feature-landing-pages';

function featuresNavActive(pathname: string) {
  return pathname === '/features' || pathname.startsWith('/features/');
}

export function SiteFeaturesNavMenu() {
  const pathname = usePathname();
  const active = featuresNavActive(pathname);

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
        Features
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="grid w-[min(100vw-2rem,24rem)] gap-3 border-violet-200/20 bg-[#100d1f]/98 p-2 md:w-[24rem]">
          <Link
            href="/features"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-violet-50 transition hover:bg-violet-500/15"
          >
            All features
            <span className="mt-0.5 block text-xs font-normal text-violet-200/70">
              One connected system for your agency
            </span>
          </Link>
          {FEATURE_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="my-1 border-t border-white/10" />
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/60">
                {group.label}
              </p>
              {group.items.map((item) => {
                const itemActive = isRouteActive(item.href, pathname, false);

                return (
                  <Link
                    key={`${group.label}-${item.href}-${item.label}`}
                    href={item.href}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm text-violet-100/85 transition hover:bg-violet-500/15 hover:text-violet-50',
                      itemActive && 'bg-violet-500/10 text-violet-50',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
