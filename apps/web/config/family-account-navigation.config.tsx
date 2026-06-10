import {
  Calendar,
  CheckSquare,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  StickyNote,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { FAMILY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
import { isFamilyNavModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
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

export function buildFamilySpaceNavChildren(
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
    tasks: () =>
      access.canViewDashboard && isFamilyNavModuleEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountCommunityTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
          }
        : null,
    calendar: () =>
      access.canViewDashboard && isFamilyNavModuleEnabled(ms, 'calendar')
        ? {
            label: 'Calendar',
            path: createPath(pathsConfig.app.accountFamilyCalendar, account),
            Icon: <Calendar className={iconClasses} />,
          }
        : null,
    meal_plan: () =>
      access.canViewDashboard && isFamilyNavModuleEnabled(ms, 'meal_plan')
        ? {
            label: 'Meal Plan',
            path: createPath(pathsConfig.app.accountMealPlan, account),
            Icon: <UtensilsCrossed className={iconClasses} />,
          }
        : null,
    shopping: () =>
      access.canViewDashboard && isFamilyNavModuleEnabled(ms, 'shopping')
        ? {
            label: 'Shopping',
            path: createPath(pathsConfig.app.accountShopping, account),
            Icon: <ShoppingCart className={iconClasses} />,
          }
        : null,
    notes: () =>
      access.canViewDashboard && isFamilyNavModuleEnabled(ms, 'notes')
        ? {
            label: 'Notes and files',
            path: createPath(pathsConfig.app.accountNotes, account),
            Icon: <StickyNote className={iconClasses} />,
          }
        : null,
    members: () =>
      access.canViewMembers && isFamilyNavModuleEnabled(ms, 'members')
        ? {
            label: 'Members',
            path: createPath(pathsConfig.app.accountMembers, account),
            Icon: <Users className={iconClasses} />,
          }
        : null,
    settings: () => null,
  };

  const items: NavChild[] = [];
  for (const key of FAMILY_WORKSPACE_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }
  return items;
}

export function buildFamilySettingsChildren(
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
