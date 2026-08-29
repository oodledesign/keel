import {
  Bell,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mic,
  Settings,
  StickyNote,
  UserRound,
  Users,
} from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
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
  if (!moduleSettings) return true;
  if (!(key in moduleSettings)) return true;
  return isAccountModuleEnabled(moduleSettings, key);
}

export function buildBuildingSurveyorSpaceNavChildren(
  account: string,
  access: TeamAccountAccess,
  moduleSettings?: Record<string, boolean>,
  options?: { pipelineBoardName?: string },
): NavChild[] {
  const ms = moduleSettings;
  const home = createPath(pathsConfig.app.accountHome, account);
  const pipelineBoardName =
    options?.pipelineBoardName?.trim() || 'Enquiries';

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
            label: 'Clients',
            path: createPath(pathsConfig.app.accountClients, account),
            Icon: <UserRound className={iconClasses} />,
          }
        : null,
    meetings: () =>
      access.canViewClients && isEnabled(ms, 'clients')
        ? {
            label: 'Transcripts',
            path: createPath(pathsConfig.app.accountMeetings, account),
            Icon: <Mic className={iconClasses} />,
          }
        : null,
    surveys: () =>
      access.canViewInvoices && isEnabled(ms, 'proposals')
        ? {
            label: 'Surveys',
            path: createPath(pathsConfig.app.accountSurveys, account),
            Icon: <FileText className={iconClasses} />,
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
    docs: () => null,
    tasks: () =>
      access.canViewDashboard && isEnabled(ms, 'tasks')
        ? {
            label: 'Tasks',
            path: createPath(pathsConfig.app.accountTasks, account),
            Icon: <CheckSquare className={iconClasses} />,
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
  for (const key of BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER) {
    if (key === 'settings') continue;
    const factory = registry[key];
    if (!factory) continue;
    const item = factory();
    if (item) items.push(item);
  }

  return items;
}

export function buildBuildingSurveyorSettingsChildren(
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
      label: 'Notifications',
      path: createPath(pathsConfig.app.accountNotificationsSettings, account),
      Icon: <Bell className={iconClasses} />,
    },
  ];
}
