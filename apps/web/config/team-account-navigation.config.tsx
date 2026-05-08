import {
  Briefcase,
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  MessageSquareText,
  PenLine,
  Share2,
  Settings,
  ShoppingCart,
  StickyNote,
  CheckSquare,
  Users,
  UtensilsCrossed,
  Video,
} from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import {
  isAccountModuleEnabled,
  isFeedflowModuleEnabled,
  isRanklyModuleEnabled,
  isSignaturesModuleEnabled,
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
      ...(access.canViewDashboard && isWorkModuleEnabled(ms, 'pipeline')
        ? [
            {
              label: 'common:routes.pipeline',
              path: createPath(pathsConfig.app.accountPipeline, account),
              Icon: <Kanban className={iconClasses} />,
            },
          ]
        : []),
      ...(access.canViewDashboard && isWorkModuleEnabled(ms, 'tasks')
        ? [
            {
              label: 'common:routes.tasks',
              path: createPath(pathsConfig.app.accountTasks, account),
              Icon: <CheckSquare className={iconClasses} />,
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
      ...(access.canViewDashboard && isWorkModuleEnabled(ms, 'properties')
        ? [
            {
              label: 'Properties',
              path: createPath(pathsConfig.app.accountProperties, account),
              Icon: <Building2 className={iconClasses} />,
            },
          ]
        : []),
      ...buildWorkAppsCollapsible(account, ms),
    ];
  } else if (spaceType === 'property') {
    applicationChildren = [
      ...dashboardItem,
      {
        label: 'Properties',
        path: createPath(pathsConfig.app.accountProperties, account),
        Icon: <Building2 className={iconClasses} />,
      },
      ...(access.canViewProjects && isWorkModuleEnabled(ms, 'jobs')
        ? [
            {
              label: 'common:routes.jobs',
              path: createPath(pathsConfig.app.accountJobs, account),
              Icon: <ClipboardList className={iconClasses} />,
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
      ...(access.canViewDashboard && isWorkModuleEnabled(ms, 'tasks')
        ? [
            {
              label: 'common:routes.tasks',
              path: createPath(pathsConfig.app.accountTasks, account),
              Icon: <CheckSquare className={iconClasses} />,
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
      {
        label: 'Tasks',
        path: createPath(pathsConfig.app.accountCommunityTasks, account),
        Icon: <CheckSquare className={iconClasses} />,
      },
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
      {
        label: 'Notes',
        path: createPath(pathsConfig.app.accountCommunityNotes, account),
        Icon: <StickyNote className={iconClasses} />,
      },
      ...(access.canViewMembers
        ? [
            {
              label: 'Members',
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

/**
 * Single **Apps** submenu for Rankly, Feedflow, and Signatures. The UI kit allows only
 * one level of nesting, so Feeds + Videos appear as ordered links (Reviews → Social → Widgets → Videos).
 */
function buildWorkAppsCollapsible(
  account: string,
  moduleSettings?: Record<string, boolean>,
) {
  const ms = moduleSettings;

  const children: Array<{
    label: string;
    path: string;
    Icon?: React.ReactNode;
    end?: boolean;
  }> = [];

  if (isRanklyModuleEnabled(ms)) {
    children.push({
      label: 'common:routes.rankly',
      path: createPath(pathsConfig.app.accountRanklyDashboard, account),
      Icon: <BarChart3 className={iconClasses} />,
    });
  }

  if (isSignaturesModuleEnabled(ms)) {
    children.push({
      label: 'signatures:sidebar.label',
      path: createPath(pathsConfig.app.accountSignaturesDashboard, account),
      Icon: <PenLine className={iconClasses} />,
    });
  }

  if (isFeedflowModuleEnabled(ms)) {
    children.push(
      {
        label: 'common:routes.reviews',
        path: createPath(pathsConfig.app.accountFeedflowReviews, account),
        Icon: <MessageSquareText className={iconClasses} />,
      },
      {
        label: 'common:routes.socialFeeds',
        path: createPath(
          pathsConfig.app.accountFeedflowSocialAccounts,
          account,
        ),
        Icon: <Share2 className={iconClasses} />,
      },
      {
        label: 'common:routes.widgets',
        path: createPath(pathsConfig.app.accountFeedflowWidgets, account),
        Icon: <Share2 className={iconClasses} />,
      },
      {
        label: 'common:routes.videos',
        path: createPath(pathsConfig.app.accountFeedflowVideos, account),
        Icon: <Video className={iconClasses} />,
      },
    );
  }

  if (children.length === 0) {
    return [];
  }

  return [
    {
      label: 'common:routes.apps',
      path: createPath(pathsConfig.app.accountHome, account),
      Icon: <LayoutGrid className={iconClasses} />,
      collapsible: true,
      collapsed: false,
      children,
    },
  ];
}
