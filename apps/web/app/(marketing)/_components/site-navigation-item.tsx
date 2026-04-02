'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavigationMenuItem } from '@kit/ui/navigation-menu';
import { cn, isRouteActive } from '@kit/ui/utils';

const getClassName = (path: string, currentPathName: string) => {
  const isActive = isRouteActive(path, currentPathName);

  return cn(
    'inline-flex w-max rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300',
    {
      'text-violet-100/75 hover:bg-violet-500/10 hover:text-violet-50':
        !isActive,
      'bg-violet-500/15 text-violet-50': isActive,
    },
  );
};

export function SiteNavigationItem({
  path,
  children,
}: React.PropsWithChildren<{
  path: string;
}>) {
  const currentPathName = usePathname();
  const className = getClassName(path, currentPathName);

  return (
    <NavigationMenuItem key={path}>
      <Link className={className} href={path} as={path} prefetch={true}>
        {children}
      </Link>
    </NavigationMenuItem>
  );
}
