import {
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileText,
  Kanban,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  StickyNote,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import {
  buildCommunitySettingsChildren,
  buildCommunitySpaceNavChildren,
} from '~/config/community-account-navigation.config';
import {
  buildFamilySettingsChildren,
  buildFamilySpaceNavChildren,
} from '~/config/family-account-navigation.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import {
  buildPropertySettingsChildren,
  buildPropertySpaceNavChildren,
} from '~/config/property-account-navigation.config';
import {
  type WorkNavCounts,
  buildWorkSettingsChildren,
  buildWorkSpaceNavChildren,
} from '~/config/work-account-navigation.config';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/workspace-profile';

const iconClasses = 'w-4';

const getRoutes = (
  account: string,
  profile: WorkspaceProfile,
  accessInput?: {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
    companyRole?: string | null;
  },
  moduleSettings?: Record<string, boolean>,
  navCounts?: WorkNavCounts,
) => {
  const access = getTeamAccountAccess(accessInput);
  const ms = moduleSettings;
  const spaceType = spaceTypeFromProfile(profile);

  let applicationChildren: Array<{
    label: string;
    path: string;
    Icon: React.ReactNode;
    end?: boolean;
    renderAction?: React.ReactNode;
  }> = [];

  if (profile === 'work_design') {
    applicationChildren = buildWorkSpaceNavChildren(
      account,
      access,
      ms,
      navCounts,
    ) as typeof applicationChildren;
  } else if (profile === 'work_property') {
    applicationChildren = buildPropertySpaceNavChildren(
      account,
      access,
      ms,
    ) as typeof applicationChildren;
  } else if (profile === 'family') {
    applicationChildren = buildFamilySpaceNavChildren(
      account,
      access,
      ms,
    ) as typeof applicationChildren;
  } else if (profile === 'community') {
    applicationChildren = buildCommunitySpaceNavChildren(
      account,
      access,
      ms,
    ) as typeof applicationChildren;
  }

  const settingsChildren =
    profile === 'work_design'
      ? buildWorkSettingsChildren(account, access, 'work')
      : profile === 'work_property'
        ? buildPropertySettingsChildren(account, access)
        : profile === 'family'
          ? buildFamilySettingsChildren(account, access)
          : profile === 'community'
            ? buildCommunitySettingsChildren(account, access)
            : [
                ...(access.canViewSettings
                  ? [
                      {
                        label: 'Workspace settings',
                        path: createPath(
                          pathsConfig.app.accountSettings,
                          account,
                        ),
                        Icon: <Settings className={iconClasses} />,
                      },
                    ]
                  : []),
              ];

  const routes: Array<{
    label: string;
    children: typeof applicationChildren;
    collapsible?: boolean;
  }> = [{ label: 'ozer-nav', children: applicationChildren }];

  if (settingsChildren.length > 0) {
    routes.push({
      label: 'ozer-nav-settings',
      collapsible: false,
      children: settingsChildren,
    });
  }

  return routes;
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
  profile: WorkspaceProfile = 'work_design',
  navCounts?: WorkNavCounts,
) {
  return NavigationConfigSchema.parse({
    routes: getRoutes(account, profile, accessInput, moduleSettings, navCounts),
    style: process.env.NEXT_PUBLIC_TEAM_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_TEAM_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  });
}

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}
