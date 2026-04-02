import {
  Briefcase,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  StickyNote,
  CheckSquare,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import {
  isAccountModuleEnabled,
  isWorkModuleEnabled,
  type WorkspaceSpaceType,
} from '~/home/[account]/_lib/server/account-modules';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';

const iconClasses = 'w-4';

const getRoutes = (
  account: string,
  spaceType: WorkspaceSpaceType,
  accessInput?: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
    companyRole?: string | null;
  },
  moduleSettings?: Record<string, boolean>,
) => {
  const access = getTeamAccountAccess(accessInput);
  const ms = moduleSettings;

  const dashboardItem =
    access.canViewDashboard
      ? [
          {
            label: 'common:routes.dashboard',
            path: pathsConfig.app.accountHome.replace('[account]', account),
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          },
        ]
      : [];

  let applicationChildren: Array<{
    label: string;
    path: string;
    Icon: React.ReactNode;
    end?: boolean;
  }> = [];

  if (spaceType === 'work') {
    applicationChildren = [
      ...dashboardItem,
      ...(access.canViewProjects && isWorkModuleEnabled(ms, 'jobs')
        ? [
            {
              label: 'common:routes.jobs',
              path: createPath(pathsConfig.app.accountJobs, account),
              Icon: <ClipboardList className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewSchedule && isWorkModuleEnabled(ms, 'schedule')
        ? [
            {
              label: 'Schedule',
              path: createPath(pathsConfig.app.accountSchedule, account),
              Icon: <Calendar className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewClients && isWorkModuleEnabled(ms, 'clients')
        ? [
            {
              label: 'common:routes.clients',
              path: createPath(pathsConfig.app.accountClients, account),
              Icon: <Briefcase className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewInvoices && isWorkModuleEnabled(ms, 'invoices')
        ? [
            {
              label: 'Invoices',
              path: createPath(pathsConfig.app.accountInvoices, account),
              Icon: <FileText className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewMembers && isWorkModuleEnabled(ms, 'team')
        ? [
            {
              label: 'common:routes.team',
              path: createPath(pathsConfig.app.accountMembers, account),
              Icon: <Users className={iconClasses} />,
            },
          ]
        : []),
    ];
  } else if (spaceType === 'family') {
    applicationChildren = [
      ...dashboardItem,
      ...(isAccountModuleEnabled(ms, 'calendar')
        ? [
            {
              label: 'Calendar',
              path: createPath(pathsConfig.app.accountFamilyCalendar, account),
              Icon: <Calendar className={iconClasses} />,
            },
          ]
        : []),
      ...(isAccountModuleEnabled(ms, 'shopping')
        ? [
            {
              label: 'Shopping',
              path: createPath(pathsConfig.app.accountShopping, account),
              Icon: <ShoppingCart className={iconClasses} />,
            },
          ]
        : []),
      ...(isAccountModuleEnabled(ms, 'meal_plan')
        ? [
            {
              label: 'Meal plan',
              path: createPath(pathsConfig.app.accountMealPlan, account),
              Icon: <UtensilsCrossed className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewMembers && isAccountModuleEnabled(ms, 'team')
        ? [
            {
              label: 'common:routes.team',
              path: createPath(pathsConfig.app.accountMembers, account),
              Icon: <Users className={iconClasses} />,
            },
          ]
        : []),
    ];
  } else {
    applicationChildren = [
      ...dashboardItem,
      ...(isAccountModuleEnabled(ms, 'schedule')
        ? [
            {
              label: 'Schedule',
              path: createPath(pathsConfig.app.accountCommunitySchedule, account),
              Icon: <Calendar className={iconClasses} />,
            },
          ]
        : []),
      ...(isAccountModuleEnabled(ms, 'tasks')
        ? [
            {
              label: 'Tasks',
              path: createPath(pathsConfig.app.accountCommunityTasks, account),
              Icon: <CheckSquare className={iconClasses} />,
            },
          ]
        : []),
      ...(isAccountModuleEnabled(ms, 'notes')
        ? [
            {
              label: 'Notes',
              path: createPath(pathsConfig.app.accountCommunityNotes, account),
              Icon: <StickyNote className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewMembers && isAccountModuleEnabled(ms, 'team')
        ? [
            {
              label: 'common:routes.team',
              path: createPath(pathsConfig.app.accountMembers, account),
              Icon: <Users className={iconClasses} />,
            },
          ]
        : []),
    ];
  }

  const settingsChildren = [
    ...(access.canViewSettings
      ? [
          {
            label: 'common:routes.settings',
            path: createPath(pathsConfig.app.accountSettings, account),
            Icon: <Settings className={iconClasses} />,
          },
        ]
      : []),
    ...(spaceType === 'work' &&
    access.canViewBilling &&
    featureFlagsConfig.enableTeamAccountBilling
      ? [
          {
            label: 'common:routes.billing',
            path: createPath(pathsConfig.app.accountBilling, account),
            Icon: <CreditCard className={iconClasses} />,
          },
        ]
      : []),
  ];

  return [
    { label: 'common:routes.application', children: applicationChildren },
    {
      label: 'common:routes.settings',
      collapsible: false,
      children: settingsChildren,
    },
  ];
};

export function getTeamAccountSidebarConfig(
  account: string,
  accessInput?: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
    companyRole?: string | null;
  },
  moduleSettings?: Record<string, boolean>,
  spaceType: WorkspaceSpaceType = 'work',
) {
  return NavigationConfigSchema.parse({
    routes: getRoutes(account, spaceType, accessInput, moduleSettings),
    style: process.env.NEXT_PUBLIC_TEAM_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_TEAM_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  });
}

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}
