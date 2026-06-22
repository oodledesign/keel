'use client';

import { usePathname } from 'next/navigation';

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from '@kit/ui/navigation-menu';
import { cn } from '@kit/ui/utils';

import { SiteFeaturesNavPanel } from './site-features-nav-panel';

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
        <SiteFeaturesNavPanel />
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
