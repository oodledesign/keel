import { describe, expect, it } from 'vitest';

import { buildWorkSpaceNavSections } from '~/config/work-account-navigation.config';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';

const liteModules: Record<string, boolean> = {
  dashboard: true,
  tasks: true,
  clients: true,
  invoices: true,
  notes: true,
  team: true,
  pipeline: true,
  jobs: false,
  schedule: false,
  websites: false,
  support_tickets: false,
  finances: false,
  sops: false,
  messages: true,
  forms: false,
};

function labels(businessLite: boolean) {
  return buildWorkSpaceNavSections(
    'lite-studio',
    getTeamAccountAccess({ role: 'owner' }),
    liteModules,
    undefined,
    false,
    businessLite,
  )
    .flatMap((section) => section.children)
    .map((item) => item.label);
}

describe('Business Lite work nav', () => {
  it('shows Pipeline and the capped Free modules', () => {
    const nav = labels(true);

    expect(nav).toContain('Pipeline');
    expect(nav).toContain('Dashboard');
    expect(nav).toContain('Tasks');
    expect(nav).toContain('Clients');
    expect(nav).toContain('Meetings');
    expect(nav).toContain('Invoices');
    expect(nav).toContain('Scheduling');
    expect(nav).toContain('Team');
    expect(nav).toContain('Notes and files');
    expect(nav).toContain('Messages');
  });

  it('hides plan-excluded entries that would otherwise appear', () => {
    const nav = labels(true);

    expect(nav).not.toContain('Planner');
    expect(nav).not.toContain('Activity');
    expect(nav).not.toContain('Projects');
    expect(nav).not.toContain('Schedule');
    expect(nav).not.toContain('Websites');
    expect(nav).not.toContain('Support');
    expect(nav).not.toContain('Finances');
    expect(nav).not.toContain('SOPs');
    expect(nav).not.toContain('Forms');
    expect(nav).not.toContain('Proposals');
    expect(nav).not.toContain('Contracts');
    expect(nav).not.toContain('Retainers');
    expect(nav).not.toContain('Second brain');
  });

  it('hides paid modules even when stored toggles have drifted on', () => {
    const nav = buildWorkSpaceNavSections(
      'lite-studio',
      getTeamAccountAccess({ role: 'owner' }),
      { ...liteModules, jobs: true, schedule: true, finances: true },
      undefined,
      false,
      true,
    )
      .flatMap((section) => section.children)
      .map((item) => item.label);

    expect(nav).not.toContain('Projects');
    expect(nav).not.toContain('Schedule');
    expect(nav).not.toContain('Finances');
  });

  it('keeps audience forms for Free workspaces with Campaigns', () => {
    const nav = buildWorkSpaceNavSections(
      'lite-studio',
      getTeamAccountAccess({ role: 'owner' }),
      { ...liteModules, campaigns: true },
      undefined,
      false,
      true,
    )
      .flatMap((section) => section.children)
      .map((item) => item.label);

    expect(nav).toContain('Forms');
  });

  it('keeps Planner and Activity for paid business workspaces', () => {
    const nav = labels(false);

    expect(nav).toContain('Planner');
    expect(nav).toContain('Activity');
    expect(nav).toContain('Pipeline');
    expect(nav).toContain('Retainers');
    expect(nav).toContain('Proposals');
  });
});

describe('Business sidebar choices', () => {
  const paidModules = {
    ...liteModules,
    jobs: true,
    schedule: true,
    'nav:planner': false,
    'nav:pipeline': false,
    'nav:dashboard': false,
    'nav:projects': true,
  };

  function paidLabels(moduleSettings: Record<string, boolean>) {
    return buildWorkSpaceNavSections(
      'studio',
      getTeamAccountAccess({ role: 'owner' }),
      moduleSettings,
      undefined,
      false,
      false,
    )
      .flatMap((section) => section.children)
      .map((item) => item.label);
  }

  it('hides links the workspace switched off, but never Dashboard', () => {
    const nav = paidLabels(paidModules);

    expect(nav).toContain('Dashboard');
    expect(nav).toContain('Projects');
    expect(nav).toContain('Tasks');
    expect(nav).not.toContain('Planner');
    expect(nav).not.toContain('Pipeline');
  });

  it('treats a workspace with only sidebar choices as unconfigured modules', () => {
    const nav = paidLabels({ 'nav:messages': false });

    expect(nav).toContain('Projects');
    expect(nav).toContain('Retainers');
    expect(nav).not.toContain('Messages');
  });
});
