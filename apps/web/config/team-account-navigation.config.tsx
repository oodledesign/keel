import { Settings } from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import {
  buildCommunitySettingsChildren,
  buildCommunitySpaceNavChildren,
} from '~/config/community-account-navigation.config';
import {
  buildFamilySettingsChildren,
  buildFamilySpaceNavChildren,
} from '~/config/family-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import {
  buildPropertySettingsChildren,
  buildPropertySpaceNavChildren,
} from '~/config/property-account-navigation.config';
import {
  type WorkNavCounts,
  buildWorkSettingsChildren,
  buildWorkSpaceNavSections,
} from '~/config/work-account-navigation.config';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

const iconClasses = 'w-4';

type NavRouteChild = {
  label: string;
  path: string;
  Icon: React.ReactNode;
  end?: boolean;
  renderAction?: React.ReactNode;
};

type NavRouteGroup = {
  label: string;
  children: NavRouteChild[];
  collapsible?: boolean;
};

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
  userFeatures?: {
    emailAssistantAvailable?: boolean;
  },
) => {
  const access = getTeamAccountAccess(accessInput);
  const ms = moduleSettings;

  const routes: NavRouteGroup[] = [];

  if (profile === 'work_design') {
    for (const section of buildWorkSpaceNavSections(
      account,
      access,
      ms,
      navCounts,
      userFeatures?.emailAssistantAvailable,
    )) {
      routes.push({
        label: section.label,
        children: section.children as NavRouteChild[],
      });
    }
  } else {
    let applicationChildren: NavRouteChild[] = [];

    if (profile === 'work_property') {
      applicationChildren = buildPropertySpaceNavChildren(
        account,
        access,
        ms,
      ) as NavRouteChild[];
    } else if (profile === 'family') {
      applicationChildren = buildFamilySpaceNavChildren(
        account,
        access,
        ms,
      ) as NavRouteChild[];
    } else if (profile === 'community') {
      applicationChildren = buildCommunitySpaceNavChildren(
        account,
        access,
        ms,
      ) as NavRouteChild[];
    }

    routes.push({ label: 'ozer-nav', children: applicationChildren });
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

  if (settingsChildren.length > 0) {
    routes.push({
      label: profile === 'work_design' ? 'Settings' : 'ozer-nav-settings',
      collapsible: false,
      children: settingsChildren as NavRouteChild[],
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
  userFeatures?: {
    emailAssistantAvailable?: boolean;
  },
) {
  return NavigationConfigSchema.parse({
    routes: getRoutes(
      account,
      profile,
      accessInput,
      moduleSettings,
      navCounts,
      userFeatures,
    ),
    style: process.env.NEXT_PUBLIC_TEAM_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_TEAM_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  });
}

function createPath(path: string, account: string) {
  return path.replace('[account]', account);
}
