import { describe, expect, it } from 'vitest';

import {
  BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER,
  WORK_BUSINESS_MODULE_ORDER,
  WORK_BUSINESS_NAV_SECTIONS,
} from '~/config/workspace-module-order';
import {
  isContractsModuleEnabled,
  resolveAccountModuleKey,
} from '~/home/[account]/_lib/server/account-modules';

describe('BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER', () => {
  it('includes contracts near surveys and docs', () => {
    expect(BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER).toContain('contracts');
    expect(BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER).toContain('forms');
    expect(BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER).toContain('surveys');

    const contracts =
      BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER.indexOf('contracts');
    const surveys = BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER.indexOf('surveys');
    const docs = BUILDING_SURVEYOR_WORKSPACE_MODULE_ORDER.indexOf('docs');
    expect(contracts).toBeGreaterThan(surveys);
    expect(contracts).toBeLessThan(docs);
  });

  it('does not change the business workspace contracts placement', () => {
    expect(WORK_BUSINESS_MODULE_ORDER).toContain('contracts');
  });

  it('puts retainers in the business Commercial nav, gated by clients', () => {
    const commercial = WORK_BUSINESS_NAV_SECTIONS.find(
      (section) => section.label === 'Commercial',
    );
    expect(WORK_BUSINESS_MODULE_ORDER).toContain('retainers');
    expect(commercial?.keys).toContain('retainers');
    expect(resolveAccountModuleKey('retainers')).toBe('clients');
  });
});

describe('isContractsModuleEnabled', () => {
  it('treats invoices as the business contracts gate', () => {
    expect(isContractsModuleEnabled({ invoices: true }, 'work_design')).toBe(
      true,
    );
    expect(isContractsModuleEnabled({ invoices: false }, 'work_design')).toBe(
      false,
    );
  });

  it('enables surveyor contracts via the contracts key when invoices is off', () => {
    expect(
      isContractsModuleEnabled(
        { invoices: false, contracts: true },
        'building_surveyor',
      ),
    ).toBe(true);
    expect(
      isContractsModuleEnabled(
        { invoices: false, contracts: false },
        'building_surveyor',
      ),
    ).toBe(false);
    expect(
      isContractsModuleEnabled(
        { invoices: false, contracts: true },
        'work_design',
      ),
    ).toBe(false);
  });
});
