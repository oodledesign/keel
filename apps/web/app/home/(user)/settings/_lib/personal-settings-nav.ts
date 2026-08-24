import pathsConfig from '~/config/paths.config';

export type PersonalSettingsNavItem = {
  id: string;
  label: string;
  href: string;
  /** Match pathname exactly (used for General). */
  exact?: boolean;
};

export function buildPersonalSettingsNav(): PersonalSettingsNavItem[] {
  return [
    {
      id: 'general',
      label: 'General',
      href: pathsConfig.app.personalAccountSettings,
      exact: true,
    },
    {
      id: 'integrations',
      label: 'Integrations',
      href: pathsConfig.app.personalAccountIntegrationsSettings,
    },
    {
      id: 'recorder',
      label: 'Desktop recorder',
      href: pathsConfig.app.personalAccountRecorderSettings,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: pathsConfig.app.personalAccountNotificationsSettings,
    },
    {
      id: 'preferences',
      label: 'How you use Ozer',
      href: pathsConfig.app.personalAccountPreferencesSettings,
    },
    {
      id: 'tone',
      label: 'Tone of voice',
      href: pathsConfig.app.personalAccountToneSettings,
    },
    {
      id: 'shortcuts',
      label: 'Shortcuts',
      href: pathsConfig.app.personalAccountShortcutsSettings,
    },
    {
      id: 'vision',
      label: 'Personal Vision',
      href: pathsConfig.app.personalAccountVisionSettings,
    },
    {
      id: 'rewards',
      label: 'Referrals & rewards',
      href: pathsConfig.app.personalAccountRewardsSettings,
    },
    {
      id: 'dictation',
      label: 'Dictation history',
      href: pathsConfig.app.personalAccountDictationHistory,
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      href: pathsConfig.app.personalAccountAccessibility,
    },
  ];
}

export function normalizePersonalSettingsPathname(pathname: string): string {
  return pathname.replace(/^\/(app|home)/, '');
}

export function isPersonalSettingsNavActive(
  pathname: string,
  item: PersonalSettingsNavItem,
): boolean {
  const path = normalizePersonalSettingsPathname(pathname);
  const target = normalizePersonalSettingsPathname(item.href);

  if (item.exact) {
    return path === target || path === '/settings' || path === '/settings/';
  }

  return path === target || path.startsWith(`${target}/`);
}
