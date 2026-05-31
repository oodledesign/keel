import { CalendarDays, LayoutDashboard, Settings } from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

export type PersonalNavWorkspace = {
  id: string;
  label: string;
  slug: string;
  pictureUrl: string | null;
  spaceType?: string | null;
};

function navigationShell() {
  return {
    style: process.env.NEXT_PUBLIC_USER_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  };
}

/** Personal home sidebar: Home only (workspace shortcuts rendered separately). */
export function buildPersonalHomeNavRoutes() {
  const routes: z.infer<typeof NavigationConfigSchema>['routes'] = [
    {
      label: 'keel-nav',
      collapsible: false,
      children: [
        {
          label: 'Home',
          path: pathsConfig.app.home,
          Icon: <LayoutDashboard className={iconClasses} />,
          end: true,
        },
        {
          label: 'Planner',
          path: pathsConfig.app.personalPlanner,
          Icon: <CalendarDays className={iconClasses} />,
        },
      ],
    },
  ];

  return routes;
}

export const personalAccountSettingsPath = pathsConfig.app.personalAccountSettings;

export { Settings as PersonalSettingsIcon };

export function parsePersonalAccountNavigationConfig(
  routes: z.infer<typeof NavigationConfigSchema>['routes'],
) {
  return NavigationConfigSchema.parse({
    routes,
    ...navigationShell(),
  });
}

/** Layout defaults when routes are not needed. */
export const personalAccountNavigationConfig = parsePersonalAccountNavigationConfig(
  buildPersonalHomeNavRoutes(),
);
