import { describe, expect, it } from 'vitest';

import { isBillingRecoveryStatus } from './billing-recovery';

describe('isBillingRecoveryStatus', () => {
  it('includes past_due_* and suspended', () => {
    expect(isBillingRecoveryStatus('past_due_grace')).toBe(true);
    expect(isBillingRecoveryStatus('past_due_restricted')).toBe(true);
    expect(isBillingRecoveryStatus('suspended')).toBe(true);
    expect(isBillingRecoveryStatus('trial_expired')).toBe(true);
  });

  it('excludes active and canceled', () => {
    expect(isBillingRecoveryStatus('active')).toBe(false);
    expect(isBillingRecoveryStatus('canceled')).toBe(false);
    expect(isBillingRecoveryStatus(null)).toBe(false);
  });
});
