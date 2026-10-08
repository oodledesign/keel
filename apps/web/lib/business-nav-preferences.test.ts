import { describe, expect, it } from 'vitest';

import { businessFreePaidOnlyNavKeys } from '~/home/[account]/_lib/business-free-access';
import {
  BUSINESS_NAV_CHOICE_KEYS,
  businessNavPreferenceRows,
  isNavItemHidden,
  readBusinessNavVisibility,
  withoutNavPreferences,
} from '~/home/[account]/_lib/business-nav-preferences';
import {
  hasConfiguredModules,
  isAccountModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';

describe('business nav preferences', () => {
  it('never offers or hides Dashboard', () => {
    expect(BUSINESS_NAV_CHOICE_KEYS).not.toContain('dashboard');
    expect(isNavItemHidden({ 'nav:dashboard': false }, 'dashboard')).toBe(
      false,
    );
  });

  it('shows links without a saved choice', () => {
    const visible = readBusinessNavVisibility({ 'nav:proposals': false });

    expect(visible.proposals).toBe(false);
    expect(visible.tasks).toBe(true);
    expect(Object.keys(visible)).toEqual(BUSINESS_NAV_CHOICE_KEYS);
  });

  it('writes one row per choice and ignores unknown keys', () => {
    const rows = businessNavPreferenceRows('acc', {
      tasks: false,
      bogus: false,
    });

    expect(rows).toHaveLength(BUSINESS_NAV_CHOICE_KEYS.length);
    expect(rows).toContainEqual({
      account_id: 'acc',
      module_key: 'nav:tasks',
      enabled: false,
    });
    expect(rows.some((row) => row.module_key === 'nav:bogus')).toBe(false);
  });

  it('strips sidebar choices for catalogs that keep hidden pages', () => {
    expect(withoutNavPreferences({ jobs: true, 'nav:jobs': false })).toEqual({
      jobs: true,
    });
  });

  it('flags the links a Free workspace gets only after upgrading', () => {
    const paidOnly = businessFreePaidOnlyNavKeys(BUSINESS_NAV_CHOICE_KEYS);

    expect(paidOnly).toEqual(
      expect.arrayContaining(['projects', 'proposals', 'retainers', 'emails']),
    );
    expect(paidOnly).not.toContain('tasks');
    expect(paidOnly).not.toContain('messages');
  });
});

describe('module settings with sidebar choices', () => {
  it('does not count sidebar choices as configured modules', () => {
    expect(hasConfiguredModules({ 'nav:tasks': false })).toBe(false);
    expect(hasConfiguredModules({ jobs: true })).toBe(true);
    expect(isAccountModuleEnabled({ 'nav:tasks': false }, 'jobs')).toBe(true);
  });
});
