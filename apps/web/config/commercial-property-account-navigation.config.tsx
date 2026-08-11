import {
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  Settings,
  StickyNote,
  UserRound,
  Users,
} from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { buildWorkAppLinks } from '~/config/work-account-navigation.config';
import { COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
import type { TeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { isAccountModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

const iconClasses = 'w-4';

type NavChild = {
  label: string;
  path: string;
  Icon: React.ReactNode;
  end?: boolean;
};

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}

function isEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  key: string,
) {
  // Treat missing keys as enabled so new modules show before settings backfill
  if (!moduleSettings || !(key in moduleSettings)) return true;
  return isAccountModuleEnabled(moduleSettings, key);
}

export function buildCommercialPropertySpaceNavChildren(
  account: string,
  access: TeamAccountAccess,
  moduleSettings?: Record<string, boolean>,
  options?: { pipelineBoardName?: string },
): NavChild[] {
  const ms = moduleSettings;
  const home = createPath(pathsConfig.app.accountHome, account);
  const pipelineBoardName = options?.pipelineBoardName?.trim() || 'WIP';

  const registry: Record<string, () => NavChild | null> = {
    dashboard: () =>
      access.canViewDashboard && isEnabled(ms, 'dashboard')
        ? {
            label: 'Dashboard',
            path: home,
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          }
        : null,
    listings: () =>
      access.canViewDashboard && isEnabled(ms, 'listings')
        ? {
            label: 'Disposals',
            path: createPath(pathsConfig.app.accountListings, account),
            Icon: <Building2 className={iconClasses} />,
          }
        : null,
    pipeline: () =>
      access.canViewDashboard && isEnabled(ms, 'pipeline')
        ? {
            label: pipelineBoardName,
            path: createPath(pathsConfig.app.accountPipeline, account),
            Icon: <ClipboardList className={iconClasses} />,
          }
        : null,
    clients: () =>
      access.canViewClients && isEnabled(ms, 'clients')
        ? {
            label: 'Contacts',
            path: createPath(pathsConfig.app.accountClients, account),
            Icon: <UserRound className={iconClasses} />,
          }
        : null,
    requirements: () =>
      access.canViewDashboard && isEnabled(ms, 'requirements')
        ? {
            label: 'Requirements',
            path: `${createPath(pathsConfig.app.accountPipeline, account)}?view=requirements`,
            Icon: <ClipboardList className={iconClasses} />,
          }
        : null,
    viewings: () =>
      access.canViewDashboard && isEnabled(ms, 'viewings')
        ? {
            label: 'Viewings',
            path: createPath(pathsConfig.app.accountViewings, account),
            Icon: <CalendarDays className={iconClasses} />,
          }
        : null,
    proposals: () =>
      access.canViewDashboard && isEnabled(ms, 'proposals')
        ? {
            label: 'HoTs / Proposals',
            path: createPath(pathsConfig.app.accountProposals, account),
            Icon: <FileText className={iconClasses} />,
          }
        : null,
    leases: () =>
      access.canViewDashboard && isEnabled(ms, 'leases')
        ? {
            label: 'Sales register',
            path: createPath(pathsConfig.app.accountLeases, account),
            Icon: <FileText className={iconClasses} />,
          }
        : null,
    reports: () =>
      access.canViewDashboard && isEnabled(ms, 'reports')
        ? {
            label: 'Insights',
            path: createPath(pathsConfig.app.accountCommercialReports, account),
            Icon: <LineChart className={iconClasses} />,
          }
        : null,
    docs: () => null,
    tasks: () =>
      access.canViewDashboard && isEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
          }
        : null,
    notes: () =>
      access.canViewDashboard && isEnabled(ms, 'notes')
        ? {
            label: 'Notes and files',
            path: createPath(pathsConfig.app.accountNotes, account),
            Icon: <StickyNote className={iconClasses} />,
          }
        : null,
    team: () =>
      access.canViewMembers && isEnabled(ms, 'team')
        ? {
            label: 'Team',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          }
        : null,
    settings: () => null,
  };

  const items: NavChild[] = [];
  for (const key of COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }

  // Entitled Business Lite / add-on apps (Signatures, Rankly, etc.) stay available
  // after Commercial Property conversion.
  items.push(...buildWorkAppLinks(account, ms));

  return items;
}

export function buildCommercialPropertySettingsChildren(
  account: string,
  access: TeamAccountAccess,
): NavChild[] {
  if (!access.canViewSettings) return [];
  return [
    {
      label: 'Workspace settings',
      path: createPath(pathsConfig.app.accountSettings, account),
      Icon: <Settings className={iconClasses} />,
    },
    {
      label: 'Website & portals',
      path: createPath(pathsConfig.app.accountCommercialPublishing, account),
      Icon: <Building2 className={iconClasses} />,
    },
  ];
}
