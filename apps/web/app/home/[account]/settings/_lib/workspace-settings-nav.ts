import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import type { TeamAccountAccess } from '~/home/[account]/_lib/role-access';
import {
  isBusinessProfile,
  spaceTypeFromProfile,
  type WorkspaceProfile,
} from '~/home/[account]/_lib/workspace-profile';
import { isVideosModuleEnabled, isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';

export type WorkspaceSettingsNavItem = {
  id: string;
  label: string;
  href: string;
  /** Match pathname exactly (used for General). */
  exact?: boolean;
};

function settingsPath(
  template: string,
  accountSlug: string,
): string {
  return template.replace('[account]', accountSlug);
}

export function buildWorkspaceSettingsNav(input: {
  accountSlug: string;
  workspaceProfile: WorkspaceProfile;
  moduleSettings?: Record<string, boolean>;
  access: TeamAccountAccess;
}): WorkspaceSettingsNavItem[] {
  const { accountSlug, workspaceProfile, moduleSettings, access } = input;
  const spaceType = spaceTypeFromProfile(workspaceProfile);
  const items: WorkspaceSettingsNavItem[] = [
    {
      id: 'general',
      label: 'General',
      href: settingsPath(pathsConfig.app.accountSettings, accountSlug),
      exact: true,
    },
  ];

  if (isBusinessProfile(workspaceProfile)) {
    items.push({
      id: 'payments',
      label: 'Payments',
      href: settingsPath(pathsConfig.app.accountPaymentSettings, accountSlug),
    });

    if (spaceType === 'work') {
      items.push({
        id: 'brand',
        label: 'Brand',
        href: settingsPath(pathsConfig.app.accountBrandSettings, accountSlug),
      });

      if (isWorkModuleEnabled(moduleSettings, 'tasks')) {
        items.push({
          id: 'task-automation',
          label: 'Task automation',
          href: settingsPath(
            pathsConfig.app.accountTaskAutomationSettings,
            accountSlug,
          ),
        });
      }
    }

    items.push({
      id: 'knowledge',
      label: 'Knowledge base',
      href: settingsPath(pathsConfig.app.accountBrainKnowledge, accountSlug),
    });

    if (isVideosModuleEnabled(moduleSettings)) {
      items.push({
        id: 'videos',
        label: 'Video hosting',
        href: settingsPath(pathsConfig.app.accountVideoSettings, accountSlug),
      });
    }

    if (
      access.canViewBilling &&
      featureFlagsConfig.enableTeamAccountBilling
    ) {
      items.push({
        id: 'billing',
        label: 'Billing',
        href: settingsPath(pathsConfig.app.accountBilling, accountSlug),
      });
    }
  } else if (spaceType === 'community' || spaceType === 'family') {
    if (access.canViewDashboard) {
      items.push({
        id: 'knowledge',
        label: 'Knowledge base',
        href: settingsPath(pathsConfig.app.accountBrainKnowledge, accountSlug),
      });
    }

    if (
      access.canViewBilling &&
      featureFlagsConfig.enableTeamAccountBilling
    ) {
      items.push({
        id: 'billing',
        label: 'Billing',
        href: settingsPath(pathsConfig.app.accountBilling, accountSlug),
      });
    }
  }

  return items;
}

export function normalizeSettingsPathname(pathname: string): string {
  return pathname.replace(/^\/(app|home)/, '');
}

export function isWorkspaceSettingsNavActive(
  pathname: string,
  item: WorkspaceSettingsNavItem,
  accountSlug: string,
): boolean {
  const path = normalizeSettingsPathname(pathname);
  const target = normalizeSettingsPathname(item.href);

  if (item.exact) {
    return (
      path === target ||
      path === `/${accountSlug}/settings` ||
      path === `/${accountSlug}/settings/`
    );
  }

  return path === target || path.startsWith(`${target}/`);
}
