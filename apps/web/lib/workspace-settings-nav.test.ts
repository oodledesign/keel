import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceSettingsNav,
  isWorkspaceSettingsNavActive,
} from '~/home/[account]/settings/_lib/workspace-settings-nav';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';

describe('buildWorkspaceSettingsNav', () => {
  const ownerAccess = getTeamAccountAccess({ role: 'owner' });

  it('includes business workspace sections', () => {
    const items = buildWorkspaceSettingsNav({
      accountSlug: 'oodle',
      workspaceProfile: 'work_design',
      moduleSettings: { videos: true },
      access: ownerAccess,
    });

    expect(items.map((item) => item.id)).toContain('general');
    expect(items.map((item) => item.id)).toContain('payments');
    expect(items.map((item) => item.id)).toContain('brand');
    expect(items.map((item) => item.id)).toContain('knowledge');
    expect(items.map((item) => item.id)).toContain('videos');
  });

  it('marks general as exact match only', () => {
    expect(
      isWorkspaceSettingsNavActive(
        '/app/oodle/settings',
        { id: 'general', label: 'General', href: '/app/oodle/settings', exact: true },
        'oodle',
      ),
    ).toBe(true);

    expect(
      isWorkspaceSettingsNavActive(
        '/app/oodle/settings/payments',
        { id: 'general', label: 'General', href: '/app/oodle/settings', exact: true },
        'oodle',
      ),
    ).toBe(false);

    expect(
      isWorkspaceSettingsNavActive(
        '/app/oodle/settings/payments',
        {
          id: 'payments',
          label: 'Payments',
          href: '/app/oodle/settings/payments',
        },
        'oodle',
      ),
    ).toBe(true);
  });
});
