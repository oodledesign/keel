import { describe, expect, it } from 'vitest';

import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import {
  buildWorkspaceSettingsNav,
  isWorkspaceSettingsNavActive,
} from '~/home/[account]/settings/_lib/workspace-settings-nav';

describe('buildWorkspaceSettingsNav', () => {
  const ownerAccess = getTeamAccountAccess({ role: 'owner' });

  it('includes full business workspace sections for work_design', () => {
    const items = buildWorkspaceSettingsNav({
      accountSlug: 'oodle',
      workspaceProfile: 'work_design',
      moduleSettings: { finances: true, tasks: true },
      access: ownerAccess,
    });

    const ids = items.map((item) => item.id);
    expect(ids).toContain('general');
    expect(ids).toContain('payments');
    expect(ids).toContain('services');
    expect(ids).toContain('brand');
    expect(ids).toContain('templates');
    expect(ids).toContain('knowledge');
    expect(ids).toContain('task-automation');
  });

  it('limits commercial property workspaces to agency-relevant settings', () => {
    const items = buildWorkspaceSettingsNav({
      accountSlug: 'bracketts',
      workspaceProfile: 'commercial_property',
      moduleSettings: {},
      access: ownerAccess,
    });

    const ids = items.map((item) => item.id);
    expect(ids).toEqual([
      'general',
      'notifications',
      'focus',
      'activity',
      'brand',
      'brand-voice',
    ]);
    expect(ids).not.toContain('payments');
    expect(ids).not.toContain('services');
    expect(ids).not.toContain('templates');
    expect(ids).not.toContain('knowledge');
    expect(ids).not.toContain('finances');
  });

  it('excludes invoice and brain settings for landlord property workspaces', () => {
    const items = buildWorkspaceSettingsNav({
      accountSlug: 'landlord-co',
      workspaceProfile: 'work_property',
      moduleSettings: { finances: true },
      access: ownerAccess,
    });

    const ids = items.map((item) => item.id);
    expect(ids).toContain('finances');
    expect(ids).not.toContain('payments');
    expect(ids).not.toContain('services');
    expect(ids).not.toContain('templates');
    expect(ids).not.toContain('knowledge');
  });

  it('marks general as exact match only', () => {
    expect(
      isWorkspaceSettingsNavActive(
        '/app/oodle/settings',
        {
          id: 'general',
          label: 'General',
          href: '/app/oodle/settings',
          exact: true,
        },
        'oodle',
      ),
    ).toBe(true);

    expect(
      isWorkspaceSettingsNavActive(
        '/app/oodle/settings/payments',
        {
          id: 'general',
          label: 'General',
          href: '/app/oodle/settings',
          exact: true,
        },
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
