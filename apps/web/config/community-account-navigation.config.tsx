import {
  Calendar,
  CheckSquare,
  LayoutDashboard,
  Settings,
  StickyNote,
  Users,
} from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { COMMUNITY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
import { isCommunityNavModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
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

export function buildCommunitySpaceNavChildren(
  account: string,
  access: TeamAccountAccess,
  moduleSettings?: Record<string, boolean>,
): NavChild[] {
  const ms = moduleSettings;
  const home = createPath(pathsConfig.app.accountHome, account);

  const registry: Record<string, () => NavChild | null> = {
    dashboard: () =>
      access.canViewDashboard
        ? {
            label: 'Dashboard',
            path: home,
            Icon: <LayoutDashboard className={iconClasses} />,
            end: true,
          }
        : null,
    schedule: () =>
      access.canViewDashboard && isCommunityNavModuleEnabled(ms, 'schedule')
        ? {
            label: 'Schedule',
            path: createPath(pathsConfig.app.accountCommunitySchedule, account),
            Icon: <Calendar className={iconClasses} />,
          }
        : null,
    tasks: () =>
      access.canViewDashboard && isCommunityNavModuleEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountCommunityTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
          }
        : null,
    notes: () =>
      access.canViewDashboard && isCommunityNavModuleEnabled(ms, 'notes')
        ? {
            label: 'Notes',
            path: createPath(pathsConfig.app.accountNotes, account),
            Icon: <StickyNote className={iconClasses} />,
          }
        : null,
    members: () =>
      access.canViewMembers && isCommunityNavModuleEnabled(ms, 'members')
        ? {
            label: 'Members',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          }
        : null,
    settings: () => null,
  };

  const items: NavChild[] = [];
  for (const key of COMMUNITY_WORKSPACE_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }
  return items;
}

export function buildCommunitySettingsChildren(
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
