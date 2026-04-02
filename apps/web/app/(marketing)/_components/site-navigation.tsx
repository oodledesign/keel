import Link from 'next/link';

import { Menu } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { NavigationMenu, NavigationMenuList } from '@kit/ui/navigation-menu';
import { Trans } from '@kit/ui/trans';

import { SiteNavigationItem } from './site-navigation-item';

const links = {
  Features: {
    label: 'marketing:features',
    path: '/#built-for',
  },
  Pricing: {
    label: 'marketing:pricing',
    path: '/#pricing',
  },
  Team: {
    label: 'marketing:team',
    path: '/contact',
  },
};

export function SiteNavigation() {
  const NavItems = Object.values(links).map((item) => {
    return (
      <SiteNavigationItem key={item.path} path={item.path}>
        <Trans i18nKey={item.label} />
      </SiteNavigationItem>
    );
  });

  return (
    <>
      <div className={'hidden items-center justify-center md:flex'}>
        <NavigationMenu>
          <NavigationMenuList className={'gap-x-2 rounded-full border border-violet-200/10 bg-white/[0.03] p-1'}>
            {NavItems}
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={'Open Menu'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/20 bg-violet-500/10 text-violet-100 transition-colors hover:bg-violet-500/20"
      >
        <Menu className={'h-5 w-5'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent className={'w-full border-violet-200/20 bg-[#100d1f]/95 text-violet-100'}>
        {Object.values(links).map((item) => {
          const className =
            'flex h-full w-full items-center rounded-md px-2 py-1.5 text-violet-100/85 transition-colors hover:bg-violet-500/15 hover:text-violet-50';

          return (
            <DropdownMenuItem key={item.path} asChild>
              <Link className={className} href={item.path}>
                <Trans i18nKey={item.label} />
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
