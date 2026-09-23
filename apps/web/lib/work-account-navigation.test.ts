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
  messages: false,
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
  it('shows Pipeline and the capped Lite modules', () => {
    const nav = labels(true);

    expect(nav).toContain('Pipeline');
    expect(nav).toContain('Dashboard');
    expect(nav).toContain('Tasks');
    expect(nav).toContain('Clients');
    expect(nav).toContain('Meetings');
    expect(nav).toContain('Invoices');
    expect(nav).toContain('Proposals');
    expect(nav).toContain('Contracts');
    expect(nav).toContain('Scheduling');
    expect(nav).toContain('Team');
    expect(nav).toContain('Notes and files');
    expect(nav).toContain('Second brain');
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
    expect(nav).not.toContain('Messages');
    expect(nav).not.toContain('Forms');
  });

  it('keeps Planner and Activity for paid business workspaces', () => {
    const nav = labels(false);

    expect(nav).toContain('Planner');
    expect(nav).toContain('Activity');
    expect(nav).toContain('Pipeline');
  });
});
