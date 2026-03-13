import {
  Briefcase,
  CheckSquare,
  Church,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  Settings,
  TicketCheck,
  User,
  Users,
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

const routes = [
  {
    label: 'Dashboard',
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
    children: [
      {
        label: 'Pipeline',
        path: '/home/pipeline',
        Icon: <Compass className={iconClasses} />,
      },
      {
        label: 'Clients',
        path: '/home/clients',
        Icon: <Users className={iconClasses} />,
      },
      {
        label: 'Tasks',
        path: '/home/tasks',
        Icon: <CheckSquare className={iconClasses} />,
      },
      {
        label: 'Support',
        path: '/home/support',
        Icon: <TicketCheck className={iconClasses} />,
      },
    ],
  },
  {
    label: 'Life',
    children: [
      {
        label: 'Personal',
        path: '/home/life/personal',
        Icon: <User className={iconClasses} />,
      },
      {
        label: 'Family',
        path: '/home/life/family',
        Icon: <Heart className={iconClasses} />,
      },
      {
        label: 'Homegroup',
        path: '/home/life/homegroup',
        Icon: <Church className={iconClasses} />,
      },
    ],
  },
  { divider: true },
  {
    label: 'Account',
    children: [
      {
        label: 'Settings',
        path: pathsConfig.app.personalAccountSettings,
        Icon: <Settings className={iconClasses} />,
      },
    ],
  },
] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

export const personalAccountNavigationConfig = NavigationConfigSchema.parse({
  routes,
  style: process.env.NEXT_PUBLIC_USER_NAVIGATION_STYLE,
  sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
  sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
});
