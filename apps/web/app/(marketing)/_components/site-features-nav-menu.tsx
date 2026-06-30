'use client';

import { usePathname } from 'next/navigation';

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from '@kit/ui/navigation-menu';
import { cn } from '@kit/ui/utils';

import { marketingNavLinkActive, marketingNavTrigger } from '~/lib/marketing/marketing-ui';

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
        className={cn(marketingNavTrigger, active && marketingNavLinkActive)}
      >
        Features
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <SiteFeaturesNavPanel />
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
