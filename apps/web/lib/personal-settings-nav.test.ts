import { describe, expect, it } from 'vitest';

import {
  buildPersonalSettingsNav,
  isPersonalSettingsNavActive,
} from '~/home/(user)/settings/_lib/personal-settings-nav';

describe('buildPersonalSettingsNav', () => {
  it('includes the main personal settings sections', () => {
    const items = buildPersonalSettingsNav();

    expect(items.map((item) => item.id)).toEqual([
      'general',
      'integrations',
      'recorder',
      'preferences',
      'shortcuts',
      'dictation',
      'accessibility',
    ]);
  });

  it('marks general as exact match only', () => {
    expect(
      isPersonalSettingsNavActive('/app/settings', {
        id: 'general',
        label: 'General',
        href: '/app/settings',
        exact: true,
      }),
    ).toBe(true);

    expect(
      isPersonalSettingsNavActive('/app/settings/integrations', {
        id: 'general',
        label: 'General',
        href: '/app/settings',
        exact: true,
      }),
    ).toBe(false);

    expect(
      isPersonalSettingsNavActive('/app/settings/integrations', {
        id: 'integrations',
        label: 'Integrations',
        href: '/app/settings/integrations',
      }),
    ).toBe(true);
  });
});
