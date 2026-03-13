import { Briefcase, Calendar, ClipboardList, CreditCard, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';

const iconClasses = 'w-4';

const getRoutes = (
  account: string,
  accessInput?: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
    companyRole?: string | null;
  },
) => {
  const access = getTeamAccountAccess(accessInput);
  const applicationChildren = [
    ...(access.canViewDashboard
      ? [
          {
            label: 'common:routes.dashboard',
            path: pathsConfig.app.accountHome.replace('[account]', account),
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          },
        ]
      : []),
    ...(access.canViewProjects
      ? [
          {
            label: 'common:routes.jobs',
            path: createPath(pathsConfig.app.accountJobs, account),
            Icon: <ClipboardList className={iconClasses} />,
          },
        ]
      : []),
    ...(access.canViewSchedule
      ? [
          {
            label: 'Schedule',
            path: createPath(pathsConfig.app.accountSchedule, account),
            Icon: <Calendar className={iconClasses} />,
          },
        ]
      : []),
    ...(access.canViewClients
      ? [
          {
            label: 'common:routes.clients',
            path: createPath(pathsConfig.app.accountClients, account),
            Icon: <Briefcase className={iconClasses} />,
          },
        ]
      : []),
    ...(access.canViewInvoices
      ? [
          {
            label: 'Invoices',
            path: createPath(pathsConfig.app.accountInvoices, account),
            Icon: <FileText className={iconClasses} />,
          },
        ]
      : []),
    ...(access.canViewMembers
      ? [
          {
            label: 'common:routes.team',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          },
        ]
      : []),
  ];
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
    ...(!access.canViewBilling || !featureFlagsConfig.enableTeamAccountBilling
      ? []
      : [
          {
            label: 'common:routes.billing',
            path: createPath(pathsConfig.app.accountBilling, account),
            Icon: <CreditCard className={iconClasses} />,
          },
        ]),
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
) {
  return NavigationConfigSchema.parse({
    routes: getRoutes(account, accessInput),
    style: process.env.NEXT_PUBLIC_TEAM_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_TEAM_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  });
}

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}
