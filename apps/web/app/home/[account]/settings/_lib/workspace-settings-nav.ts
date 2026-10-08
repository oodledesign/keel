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
import { canAccessWorkspaceForms } from '~/lib/workspace-forms/forms-mode';

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

const INTEGRATIONS_PROFILES: WorkspaceProfile[] = [
  'work_design',
  'commercial_property',
  'building_surveyor',
];

/** Dynamics syncs mailing-list signups, which only exist where forms do. */
export function canUseWorkspaceIntegrations(
  workspaceProfile: WorkspaceProfile,
  moduleSettings: Record<string, boolean> | null | undefined,
): boolean {
  return (
    INTEGRATIONS_PROFILES.includes(workspaceProfile) &&
    canAccessWorkspaceForms(moduleSettings)
  );
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
  canConfigureSendingDomain = true,
) {
  items.push({
    id: 'brand',
    label: 'Brand',
    href: settingsPath(pathsConfig.app.accountBrandSettings, accountSlug),
  });

  if (canConfigureSendingDomain) {
    items.push({
      id: 'sending-domain',
      label: 'Sending domain',
      href: settingsPath(
        pathsConfig.app.accountSendingDomainSettings,
        accountSlug,
      ),
    });
  }

  items.push({
    id: 'brand-voice',
    label: 'Brand voice',
    href: settingsPath(pathsConfig.app.accountBrandVoiceSettings, accountSlug),
  });
}

export function buildWorkspaceSettingsNav(input: {
  accountSlug: string;
  workspaceProfile: WorkspaceProfile;
  moduleSettings?: Record<string, boolean>;
  access: TeamAccountAccess;
  /** Paid non-lite plans (Starter/Pro, commercial, property) and grants. Lite omits. */
  canConfigureSendingDomain?: boolean;
  /** Business Lite does not include activity tracking. */
  businessLite?: boolean;
}): WorkspaceSettingsNavItem[] {
  const {
    accountSlug,
    workspaceProfile,
    moduleSettings,
    access,
    canConfigureSendingDomain = true,
    businessLite = false,
  } = input;
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
  ];

  if (workspaceProfile === 'work_design' && !businessLite) {
    items.push({
      id: 'activity',
      label: 'Activity tracking',
      href: settingsPath(
        pathsConfig.app.accountActivityPrivacySettings,
        accountSlug,
      ),
    });
  }

  if (canUseWorkspaceIntegrations(workspaceProfile, moduleSettings)) {
    items.push({
      id: 'integrations',
      label: 'Integrations',
      href: settingsPath(
        pathsConfig.app.accountIntegrationsSettings,
        accountSlug,
      ),
    });
  }

  if (access.canViewSettings) {
    items.push({
      id: 'audit',
      label: 'Audit log',
      href: settingsPath(pathsConfig.app.accountAudit, accountSlug),
    });
  }

  if (workspaceProfile === 'commercial_property') {
    appendBrandNavItems(items, accountSlug, canConfigureSendingDomain);
    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (workspaceProfile === 'work_property') {
    appendBrandNavItems(items, accountSlug, canConfigureSendingDomain);

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
    items.push({
      id: 'payments',
      label: 'Payments',
      href: settingsPath(pathsConfig.app.accountPaymentSettings, accountSlug),
    });

    if (!businessLite) {
      items.push({
        id: 'services',
        label: 'Services',
        href: settingsPath(
          pathsConfig.app.accountServicesSettings,
          accountSlug,
        ),
      });
    }

    if (isWorkModuleEnabled(moduleSettings, 'jobs')) {
      items.push({
        id: 'project-statuses',
        label: 'Project statuses',
        href: settingsPath(
          pathsConfig.app.accountProjectStatusesSettings,
          accountSlug,
        ),
      });
    }

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

    appendBrandNavItems(items, accountSlug, canConfigureSendingDomain);

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

    if (!businessLite) {
      items.push({
        id: 'knowledge',
        label: 'Knowledge base',
        href: settingsPath(pathsConfig.app.accountBrainKnowledge, accountSlug),
      });
    }

    appendBillingNavItem(items, accountSlug, access);
    return items;
  }

  if (workspaceProfile === 'building_surveyor') {
    items.push({
      id: 'survey-templates',
      label: 'Survey templates',
      href: settingsPath(
        pathsConfig.app.accountSurveyTemplatesSettings,
        accountSlug,
      ),
    });
    items.push({
      id: 'survey-phrases',
      label: 'Phrase banks',
      href: settingsPath(
        pathsConfig.app.accountSurveyPhrasesSettings,
        accountSlug,
      ),
    });
    items.push({
      id: 'survey-style',
      label: 'Survey style',
      href: settingsPath(
        pathsConfig.app.accountSurveyStyleSettings,
        accountSlug,
      ),
    });
    items.push({
      id: 'surveyor-profile',
      label: 'Surveyor profile',
      href: settingsPath(
        pathsConfig.app.accountSurveyorProfileSettings,
        accountSlug,
      ),
    });

    if (canConfigureSendingDomain) {
      items.push({
        id: 'sending-domain',
        label: 'Sending domain',
        href: settingsPath(
          pathsConfig.app.accountSendingDomainSettings,
          accountSlug,
        ),
      });
    }
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
