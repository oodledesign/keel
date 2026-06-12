import Link from 'next/link';

import { Menu } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { NavigationMenu, NavigationMenuList } from '@kit/ui/navigation-menu';
import { Trans } from '@kit/ui/trans';

import {
  mobileAppsLinks,
  SiteAppsNavMenu,
} from './site-apps-nav-menu';
import { SiteNavigationItem } from './site-navigation-item';

const primaryLinks = [
  { label: 'Personal', path: '/personal' },
  { label: 'Business', path: '/work' },
  { label: 'Property', path: '/property' },
  { label: 'Community', path: '/community' },
  {
    label: 'marketing:pricing',
    path: '/pricing',
    i18n: true,
  },
] as const;

export function SiteNavigation() {
  const NavItems = primaryLinks.map((item) => {
    return (
      <SiteNavigationItem key={item.path} path={item.path}>
        {'i18n' in item && item.i18n ? (
          <Trans i18nKey={item.label} />
        ) : (
          item.label
        )}
      </SiteNavigationItem>
    );
  });

  return (
    <>
      <div className={'hidden items-center justify-center md:flex'}>
        <NavigationMenu>
          <NavigationMenuList className={'gap-x-1 rounded-full border border-violet-200/10 bg-white/[0.03] p-1 xl:gap-x-2'}>
            {NavItems}
            <SiteAppsNavMenu />
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className={'flex justify-start sm:items-center md:hidden'}>
        <MobileDropdown />
      </div>
    </>
  );
}

function MobileDropdown() {
  const appLinks = mobileAppsLinks();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={'Open Menu'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/20 bg-violet-500/10 text-violet-100 transition-colors hover:bg-violet-500/20"
      >
        <Menu className={'h-5 w-5'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent className={'w-full border-violet-200/20 bg-[#100d1f]/95 text-violet-100'}>
        {primaryLinks.map((item) => {
          const className =
            'flex h-full w-full items-center rounded-md px-2 py-1.5 text-violet-100/85 transition-colors hover:bg-violet-500/15 hover:text-violet-50';

          return (
            <DropdownMenuItem key={item.path} asChild>
              <Link className={className} href={item.path}>
                {'i18n' in item && item.i18n ? (
                  <Trans i18nKey={item.label} />
                ) : (
                  item.label
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-violet-200/15" />
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-violet-300/70">
          Apps
        </DropdownMenuLabel>
        {appLinks.map((item) => (
          <DropdownMenuItem key={item.path} asChild>
            <Link
              className="flex h-full w-full items-center rounded-md px-2 py-1.5 text-violet-100/85 transition-colors hover:bg-violet-500/15 hover:text-violet-50"
              href={item.path}
            >
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
