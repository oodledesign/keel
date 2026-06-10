import {
  Building2,
  CheckSquare,
  LayoutDashboard,
  Settings,
  StickyNote,
  Users,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { PROPERTY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
import { isPropertyNavModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import type { TeamAccountAccess } from '~/home/[account]/_lib/role-access';

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

export function buildPropertySpaceNavChildren(
  account: string,
  access: TeamAccountAccess,
  moduleSettings?: Record<string, boolean>,
): NavChild[] {
  const ms = moduleSettings;
  const home = createPath(pathsConfig.app.accountHome, account);

  const registry: Record<string, () => NavChild | null> = {
    dashboard: () =>
      access.canViewDashboard && isPropertyNavModuleEnabled(ms, 'dashboard')
        ? {
            label: 'Dashboard',
            path: home,
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          }
        : null,
    properties: () =>
      access.canViewDashboard && isPropertyNavModuleEnabled(ms, 'properties')
        ? {
            label: 'Properties',
            path: createPath(pathsConfig.app.accountProperties, account),
            Icon: <Building2 className={iconClasses} />,
          }
        : null,
    tenants: () =>
      access.canViewClients && isPropertyNavModuleEnabled(ms, 'tenants')
        ? {
            label: 'Tenants',
            path: createPath(pathsConfig.app.accountClients, account),
            Icon: <UserRound className={iconClasses} />,
          }
        : null,
    maintenance: () =>
      access.canViewProjects && isPropertyNavModuleEnabled(ms, 'maintenance')
        ? {
            label: 'Maintenance',
            path: createPath(pathsConfig.app.accountJobs, account),
            Icon: <Wrench className={iconClasses} />,
          }
        : null,
    finances: () =>
      access.canViewDashboard && isPropertyNavModuleEnabled(ms, 'finances')
        ? {
            label: 'Finances',
            path: createPath(pathsConfig.app.accountFinances, account),
            Icon: <Wallet className={iconClasses} />,
          }
        : null,
    docs: () => null,
    tasks: () =>
      access.canViewDashboard && isPropertyNavModuleEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
          }
        : null,
    notes: () =>
      access.canViewDashboard && isPropertyNavModuleEnabled(ms, 'notes')
        ? {
            label: 'Notes and files',
            path: createPath(pathsConfig.app.accountNotes, account),
            Icon: <StickyNote className={iconClasses} />,
          }
        : null,
    team: () =>
      access.canViewMembers && isPropertyNavModuleEnabled(ms, 'team')
        ? {
            label: 'Team',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          }
        : null,
    settings: () => null,
  };

  const items: NavChild[] = [];
  for (const key of PROPERTY_WORKSPACE_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }
  return items;
}

export function buildPropertySettingsChildren(
  account: string,
  access: TeamAccountAccess,
) {
  if (!access.canViewSettings) return [];
  return [
    {
      label: 'Settings',
      path: createPath(pathsConfig.app.accountSettings, account),
      Icon: <Settings className={iconClasses} />,
    },
  ];
}
