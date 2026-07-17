'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavigationMenuItem } from '@kit/ui/navigation-menu';
import { cn, isRouteActive } from '@kit/ui/utils';

import {
  marketingNavLink,
  marketingNavLinkActive,
} from '~/lib/marketing/marketing-ui';

export function SiteNavigationItem({
  path,
  children,
}: React.PropsWithChildren<{
  path: string;
}>) {
  const currentPathName = usePathname();
  const isActive = isRouteActive(path, currentPathName);

  return (
    <NavigationMenuItem key={path}>
      <Link
        className={cn(marketingNavLink, isActive && marketingNavLinkActive)}
        href={path}
        as={path}
        prefetch={true}
      >
        {children}
      </Link>
    </NavigationMenuItem>
  );
}
