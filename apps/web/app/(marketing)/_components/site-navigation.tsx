import { NavigationMenu, NavigationMenuList } from '@kit/ui/navigation-menu';
import { Trans } from '@kit/ui/trans';

import { SiteAppsNavMenu } from './site-apps-nav-menu';
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
    <div className="hidden items-center justify-center md:flex">
      <NavigationMenu>
        <NavigationMenuList className="gap-x-1 rounded-full border border-violet-200/10 bg-white/[0.03] p-1 xl:gap-x-2">
          {NavItems}
          <SiteAppsNavMenu />
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
