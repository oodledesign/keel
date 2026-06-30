import { NavigationMenu, NavigationMenuList } from '@kit/ui/navigation-menu';
import { Trans } from '@kit/ui/trans';

import { marketingNavPill } from '~/lib/marketing/marketing-ui';

import { SiteAppsNavMenu } from './site-apps-nav-menu';
import { SiteFeaturesNavMenu } from './site-features-nav-menu';
import { SiteNavigationItem } from './site-navigation-item';
import { SiteWorkspacesNavMenu } from './site-workspaces-nav-menu';

export function SiteNavigation() {
  return (
    <div className="hidden items-center justify-center md:flex">
      <NavigationMenu>
        <NavigationMenuList className={marketingNavPill}>
          <SiteWorkspacesNavMenu />
          <SiteFeaturesNavMenu />
          <SiteAppsNavMenu />
          <SiteNavigationItem path="/pricing">
            <Trans i18nKey="marketing:pricing" />
          </SiteNavigationItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
