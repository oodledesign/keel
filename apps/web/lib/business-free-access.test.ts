import { describe, expect, it } from 'vitest';

import {
  applyBusinessFreeModuleMask,
  isBusinessFreeFeatureBlocked,
  resolveBusinessFree,
} from '~/home/[account]/_lib/business-free-access';

describe('Business Free access', () => {
  it('forces paid modules off but keeps owner toggles and add-ons', () => {
    const masked = applyBusinessFreeModuleMask({
      clients: true,
      tasks: false,
      jobs: true,
      finances: true,
      campaigns: true,
    });

    expect(masked.jobs).toBe(false);
    expect(masked.finances).toBe(false);
    expect(masked.clients).toBe(true);
    expect(masked.tasks).toBe(false);
    expect(masked.campaigns).toBe(true);
  });

  it('seeds the Free modules when nothing is configured yet', () => {
    const masked = applyBusinessFreeModuleMask({});

    expect(masked.messages).toBe(true);
    expect(masked.pipeline).toBe(true);
    expect(masked.jobs).toBe(false);
    expect(masked.websites).toBe(false);
    expect(masked.campaigns).toBeUndefined();
  });

  it('blocks paid features that ride on included modules', () => {
    for (const key of ['retainers', 'proposals', 'contracts', 'brain']) {
      expect(isBusinessFreeFeatureBlocked(key, { clients: true })).toBe(true);
    }

    for (const key of ['clients', 'meetings', 'messages', 'scheduling']) {
      expect(isBusinessFreeFeatureBlocked(key, { clients: true })).toBe(false);
    }

    expect(isBusinessFreeFeatureBlocked('projects', { jobs: true })).toBe(true);
  });

  it('allows audience forms only with Campaigns', () => {
    expect(isBusinessFreeFeatureBlocked('forms', { forms: false })).toBe(true);
    expect(
      isBusinessFreeFeatureBlocked('forms', { forms: false, campaigns: true }),
    ).toBe(false);
  });

  it('treats a lone Free entitlement as Free', () => {
    expect(
      resolveBusinessFree({
        businessTypeIsLite: false,
        entitlementKeys: ['workspace_business_lite'],
      }),
    ).toBe(true);
    expect(
      resolveBusinessFree({
        businessTypeIsLite: false,
        entitlementKeys: ['workspace_business_lite', 'workspace_business'],
      }),
    ).toBe(false);
    expect(
      resolveBusinessFree({ businessTypeIsLite: false, entitlementKeys: [] }),
    ).toBe(false);
  });
});
