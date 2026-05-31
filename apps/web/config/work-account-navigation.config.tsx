import {
  BarChart3,
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  MessageSquareText,
  PenLine,
  Settings,
  Share2,
  StickyNote,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { WORK_BUSINESS_MODULE_ORDER } from '~/config/workspace-module-order';
import {
  isFeedflowModuleEnabled,
  isRanklyModuleEnabled,
  isSignaturesModuleEnabled,
  isWorkNavModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';
import type { TeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { SidebarMenuBadge } from '@kit/ui/shadcn-sidebar';

const iconClasses = 'w-4';

export type WorkNavCounts = {
  supportOpenCount?: number;
};

type NavChild = {
  label: string;
  path: string;
  Icon: React.ReactNode;
  end?: boolean;
};

type NavCollapsible = NavChild & {
  collapsible: true;
  collapsed?: boolean;
  children: NavChild[];
};

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}

function buildWorkAppsGroup(
  account: string,
  moduleSettings?: Record<string, boolean>,
): NavCollapsible[] {
  const ms = moduleSettings;
  const children: NavChild[] = [];

  if (isRanklyModuleEnabled(ms)) {
    children.push({
      label: 'Rankly',
      path: createPath(pathsConfig.app.accountRanklyDashboard, account),
      Icon: <BarChart3 className={iconClasses} />,
    });
  }

  if (isSignaturesModuleEnabled(ms)) {
    children.push({
      label: 'Signatures',
      path: createPath(pathsConfig.app.accountSignaturesDashboard, account),
      Icon: <PenLine className={iconClasses} />,
    });
  }

  if (isFeedflowModuleEnabled(ms)) {
    children.push(
      {
        label: 'Reviews',
        path: createPath(pathsConfig.app.accountFeedflowReviews, account),
        Icon: <MessageSquareText className={iconClasses} />,
      },
      {
        label: 'Social Feeds',
        path: createPath(pathsConfig.app.accountFeedflowSocialAccounts, account),
        Icon: <Share2 className={iconClasses} />,
      },
      {
        label: 'Videos',
        path: createPath(pathsConfig.app.accountFeedflowVideos, account),
        Icon: <Video className={iconClasses} />,
      },
    );
  }

  if (children.length === 0 || !isWorkNavModuleEnabled(ms, 'apps')) {
    return [];
  }

  return [
    {
      label: 'Apps',
      path: createPath(pathsConfig.app.accountHome, account),
      Icon: <LayoutGrid className={iconClasses} />,
      collapsible: true,
      collapsed: false,
      children,
    },
  ];
}

/**
 * Work workspace sidebar items in canonical module order (account_module_settings).
 * UI label "Projects" → jobs table / module_key `jobs`.
 */
export function buildWorkSpaceNavChildren(
  account: string,
  access: TeamAccountAccess,
  moduleSettings?: Record<string, boolean>,
  navCounts?: WorkNavCounts,
): Array<NavChild | NavCollapsible> {
  const ms = moduleSettings;
  const home = createPath(pathsConfig.app.accountHome, account);

  const registry: Record<
    string,
    () => NavChild | NavCollapsible | null
  > = {
    dashboard: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'dashboard')
        ? {
            label: 'Dashboard',
            path: home,
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          }
        : null,
    projects: () =>
      access.canViewProjects && isWorkNavModuleEnabled(ms, 'projects')
        ? {
            label: 'Projects',
            path: createPath(pathsConfig.app.accountJobs, account),
            Icon: <ClipboardList className={iconClasses} />,
          }
        : null,
    tasks: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
          }
        : null,
    schedule: () =>
      access.canViewSchedule && isWorkNavModuleEnabled(ms, 'schedule')
        ? {
            label: 'Schedule',
            path: createPath(pathsConfig.app.accountSchedule, account),
            Icon: <Calendar className={iconClasses} />,
          }
        : null,
    pipeline: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'pipeline')
        ? {
            label: 'Pipeline',
            path: createPath(pathsConfig.app.accountPipeline, account),
            Icon: <Kanban className={iconClasses} />,
          }
        : null,
    clients: () =>
      access.canViewClients && isWorkNavModuleEnabled(ms, 'clients')
        ? {
            label: 'Clients',
            path: createPath(pathsConfig.app.accountClients, account),
            Icon: <Briefcase className={iconClasses} />,
          }
        : null,
    websites: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'websites')
        ? {
            label: 'Websites',
            path: createPath(pathsConfig.app.accountWebsites, account),
            Icon: <Globe className={iconClasses} />,
          }
        : null,
    support_tickets: () => {
      const openCount = navCounts?.supportOpenCount ?? 0;
      return access.canViewDashboard &&
        isWorkNavModuleEnabled(ms, 'support_tickets')
        ? {
            label: 'Support',
            path: createPath(pathsConfig.app.accountSupport, account),
            Icon: <LifeBuoy className={iconClasses} />,
            renderAction:
              openCount > 0 ? (
                <SidebarMenuBadge className="bg-blue-500/20 text-blue-300">
                  {openCount > 99 ? '99+' : openCount}
                </SidebarMenuBadge>
              ) : undefined,
          }
        : null;
    },
    invoices: () =>
      access.canViewInvoices && isWorkNavModuleEnabled(ms, 'invoices')
        ? {
            label: 'Invoices',
            path: createPath(pathsConfig.app.accountInvoices, account),
            Icon: <FileText className={iconClasses} />,
          }
        : null,
    team: () =>
      access.canViewMembers && isWorkNavModuleEnabled(ms, 'team')
        ? {
            label: 'Team',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          }
        : null,
    notes: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'notes')
        ? {
            label: 'Notes',
            path: createPath(pathsConfig.app.accountNotes, account),
            Icon: <StickyNote className={iconClasses} />,
          }
        : null,
    finances: () =>
      access.canViewDashboard && isWorkNavModuleEnabled(ms, 'finances')
        ? {
            label: 'Finances',
            path: createPath(pathsConfig.app.accountFinances, account),
            Icon: <Wallet className={iconClasses} />,
          }
        : null,
    apps: () => {
      const apps = buildWorkAppsGroup(account, ms);
      return apps[0] ?? null;
    },
    settings: () => null,
  };

  const items: Array<NavChild | NavCollapsible> = [];

  for (const key of WORK_BUSINESS_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }

  return items;
}

export function buildWorkSettingsChildren(
  account: string,
  access: TeamAccountAccess,
  spaceType: 'work',
) {
  const settings: NavChild[] = [];

  if (access.canViewSettings) {
    settings.push({
      label: 'Settings',
      path: createPath(pathsConfig.app.accountSettings, account),
      Icon: <Settings className={iconClasses} />,
    });
  }

  if (
    spaceType === 'work' &&
    access.canViewBilling &&
    featureFlagsConfig.enableTeamAccountBilling
  ) {
    settings.push({
      label: 'Billing',
      path: createPath(pathsConfig.app.accountBilling, account),
      Icon: <CreditCard className={iconClasses} />,
    });
  }

  return settings;
}
