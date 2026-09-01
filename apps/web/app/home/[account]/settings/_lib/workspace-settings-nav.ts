import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import type { TeamAccountAccess } from '~/home/[account]/_lib/role-access';
import {
  isPropertyNavModuleEnabled,
  isWorkModuleEnabled,
  isWorkNavModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';
import {
  type WorkspaceProfile,
  isGroupProfile,
} from '~/home/[account]/_lib/workspace-profile';

export type WorkspaceSettingsNavIcon = 'calendar-off';

export type WorkspaceSettingsNavItem = {
  id: string;
  label: string;
  href: string;
  /** Match pathname exactly (used for General). */
  exact?: boolean;
  icon?: WorkspaceSettingsNavIcon;
};

function settingsPath(template: string, accountSlug: string): string {
  return template.replace('[account]', accountSlug);
}

function appendBillingNavItem(
  items: WorkspaceSettingsNavItem[],
  accountSlug: string,
  access: TeamAccountAccess,
) {
  if (access.canViewBilling && featureFlagsConfig.enableTeamAccountBilling) {
    items.push({
      id: 'billing',
      label: 'Billing',
      href: settingsPath(pathsConfig.app.accountBilling, accountSlug),
    });
  }
}

function appendBrandNavItems(
  items: WorkspaceSettingsNavItem[],
  accountSlug: string,
) {
  items.push(
    {
      id: 'brand',
      label: 'Brand',
      href: settingsPath(pathsConfig.app.accountBrandSettings, accountSlug),
    },
    {
      id: 'sending-domain',
      label: 'Sending domain',
      href: settingsPath(
        pathsConfig.app.accountSendingDomainSettings,
        accountSlug,
      ),
    },
    {
      id: 'brand-voice',
      label: 'Brand voice',
      href: settingsPath(
        pathsConfig.app.accountBrandVoiceSettings,
        accountSlug,
      ),
    },
  );
}

export function buildWorkspaceSettingsNav(input: {
  accountSlug: string;
  workspaceProfile: WorkspaceProfile;
  moduleSettings?: Record<string, boolean>;
  access: TeamAccountAccess;
}): WorkspaceSettingsNavItem[] {
  const { accountSlug, workspaceProfile, moduleSettings, access } = input;
  const items: WorkspaceSettingsNavItem[] = [
    {
      id: 'general',
      label: 'General',
      href: settingsPath(pathsConfig.app.accountSettings, accountSlug),
      exact: true,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: settingsPath(
        pathsConfig.app.accountNotificationsSettings,
        accountSlug,
      ),
    },
    {
      id: 'focus',
      label: 'Focus & Availability',
      href: settingsPath(pathsConfig.app.accountFocusSettings, accountSlug),
      icon: 'calendar-off',
    },
    {
      id: 'activity',
      label: 'Activity tracking',
      href: settingsPath(
        pathsConfig.app.accountActivityPrivacySettings,
        accountSlug,
      ),
    },
  ];

  if (workspaceProfile === 'commercial_property') {
    appendBrandNavItems(items, accountSlug);
    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (workspaceProfile === 'work_property') {
    appendBrandNavItems(items, accountSlug);

    if (isPropertyNavModuleEnabled(moduleSettings, 'finances')) {
      items.push({
        id: 'finances',
        label: 'Finances',
        href: settingsPath(
          pathsConfig.app.accountFinancesSettings,
          accountSlug,
        ),
      });
    }

    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (workspaceProfile === 'work_design') {
    items.push(
      {
        id: 'payments',
        label: 'Payments',
        href: settingsPath(pathsConfig.app.accountPaymentSettings, accountSlug),
      },
      {
        id: 'services',
        label: 'Services',
        href: settingsPath(
          pathsConfig.app.accountServicesSettings,
          accountSlug,
        ),
      },
    );

    if (isWorkNavModuleEnabled(moduleSettings, 'finances')) {
      items.push({
        id: 'finances',
        label: 'Finances',
        href: settingsPath(
          pathsConfig.app.accountFinancesSettings,
          accountSlug,
        ),
      });
    }

    appendBrandNavItems(items, accountSlug);

    items.push({
      id: 'templates',
      label: 'Templates',
      href: settingsPath(
        pathsConfig.app.accountContentTemplatesSettings,
        accountSlug,
      ),
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

    items.push({
      id: 'knowledge',
      label: 'Knowledge base',
      href: settingsPath(pathsConfig.app.accountBrainKnowledge, accountSlug),
    });

    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (workspaceProfile === 'building_surveyor') {
    items.push({
      id: 'sending-domain',
      label: 'Sending domain',
      href: settingsPath(
        pathsConfig.app.accountSendingDomainSettings,
        accountSlug,
      ),
    });
    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (isGroupProfile(workspaceProfile)) {
    if (access.canViewDashboard) {
      items.push({
        id: 'knowledge',
        label: 'Knowledge base',
        href: settingsPath(pathsConfig.app.accountBrainKnowledge, accountSlug),
      });
    }

    appendBillingNavItem(items, accountSlug, access);
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
