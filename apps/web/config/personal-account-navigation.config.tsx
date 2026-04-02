import {
  Briefcase,
  Church,
  Heart,
  Kanban,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  Settings,
  User,
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

export type PersonalNavAccount = {
  label: string;
  value: string;
};

function navigationShell() {
  return {
    style: process.env.NEXT_PUBLIC_USER_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  };
}

/**
 * Route tree for the personal / app shell sidebar.
 * Cross-cutting work tools (pipeline, tasks, support) live here; per-business
 * modules (clients, jobs, invoices) stay under each work space.
 */
export function buildPersonalAccountRoutes(accounts: PersonalNavAccount[]) {
  const routes: z.infer<typeof NavigationConfigSchema>['routes'] = [
    {
      label: 'Dashboard',
      collapsible: true,
      collapsed: false,
      children: [
        {
          label: 'Home',
          path: pathsConfig.app.home,
          Icon: <LayoutDashboard className={iconClasses} />,
          end: true,
        },
      ],
    },
    {
      label: 'Work',
      collapsible: true,
      collapsed: false,
      children: [
        {
          label: 'Pipeline',
          path: '/app/pipeline',
          Icon: <Kanban className={iconClasses} />,
        },
        {
          label: 'Tasks',
          path: '/app/tasks',
          Icon: <ListTodo className={iconClasses} />,
        },
        {
          label: 'Support',
          path: '/app/support',
          Icon: <LifeBuoy className={iconClasses} />,
        },
      ],
    },
  ];

  if (featureFlagsConfig.enableTeamAccounts) {
    const businessChildren = accounts
      .filter((a) => a.value)
      .map((a) => ({
        label: a.label,
        path: pathsConfig.app.accountHome.replace('[account]', a.value),
        Icon: <Briefcase className={iconClasses} />,
      }));

    routes.push({
      label: 'Business',
      collapsible: true,
      collapsed: false,
      children: businessChildren,
    });
  }

  routes.push(
    {
      label: 'Life',
      collapsible: true,
      collapsed: false,
      children: [
        {
          label: 'Personal',
          path: '/app/life/personal',
          Icon: <User className={iconClasses} />,
        },
        {
          label: 'Family',
          path: '/app/family',
          Icon: <Heart className={iconClasses} />,
        },
        {
          label: 'Homegroup',
          path: '/app/life/homegroup',
          Icon: <Church className={iconClasses} />,
        },
      ],
    },
    { divider: true },
    {
      label: 'Account',
      collapsible: true,
      collapsed: false,
      children: [
        {
          label: 'Settings',
          path: pathsConfig.app.personalAccountSettings,
          Icon: <Settings className={iconClasses} />,
        },
      ],
    },
  );

  return routes;
}

export function parsePersonalAccountNavigationConfig(
  routes: z.infer<typeof NavigationConfigSchema>['routes'],
) {
  return NavigationConfigSchema.parse({
    routes,
    ...navigationShell(),
  });
}

/** Used for layout defaults (style / collapse) when full routes are not needed. */
export const personalAccountNavigationConfig = parsePersonalAccountNavigationConfig(
  buildPersonalAccountRoutes([]),
);
