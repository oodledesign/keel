import { describe, expect, it } from 'vitest';

import { businessPaidPlanBillingPath } from './business-billing-redirect';

describe('businessPaidPlanBillingPath', () => {
  it('sends Starter to the same workspace billing with setup + upgrade', () => {
    const path = businessPaidPlanBillingPath(
      'oodle-design',
      'ozer-business-starter',
      2,
    );

    expect(path).toContain('/oodle-design/');
    expect(path).toContain('setup=1');
    expect(path).toContain('upgrade=1');
    expect(path).toContain('product=ozer-business-starter');
    expect(path).toContain('plan=business-starter-monthly');
    expect(path).toContain('seats=2');
  });

  it('maps Pro to business-monthly', () => {
    const path = businessPaidPlanBillingPath('studio', 'ozer-business', 1);
    expect(path).toContain('product=ozer-business');
    expect(path).toContain('plan=business-monthly');
  });
});
