import { describe, expect, it } from 'vitest';

import {
  accessLevelFromBillingStatus,
  accountAllowsCapability,
  policyForAccess,
} from './account-access-matrix';

describe('accessLevelFromBillingStatus', () => {
  it('maps grace to full access', () => {
    expect(accessLevelFromBillingStatus('past_due_grace')).toBe('full_access');
  });

  it('maps restricted to restricted_access', () => {
    expect(accessLevelFromBillingStatus('past_due_restricted')).toBe(
      'restricted_access',
    );
  });

  it('maps suspended / expired / canceled to no_access', () => {
    expect(accessLevelFromBillingStatus('suspended')).toBe('no_access');
    expect(accessLevelFromBillingStatus('trial_expired')).toBe('no_access');
    expect(accessLevelFromBillingStatus('canceled')).toBe('no_access');
  });
});

describe('restricted matrix (draft)', () => {
  it('blocks invoicing and new bookings while allowing view', () => {
    expect(accountAllowsCapability('restricted_access', 'view_schedule')).toBe(
      true,
    );
    expect(
      accountAllowsCapability('restricted_access', 'create_invoices'),
    ).toBe(false);
    expect(
      accountAllowsCapability('restricted_access', 'create_bookings'),
    ).toBe(false);
  });

  it('keeps public booking as decision defaulting to allowed', () => {
    expect(policyForAccess('restricted_access', 'public_booking_pages')).toBe(
      'decision',
    );
    expect(
      accountAllowsCapability('restricted_access', 'public_booking_pages'),
    ).toBe(true);
  });

  it('blocks writes on no_access but keeps billing + public decision', () => {
    expect(accountAllowsCapability('no_access', 'create_invoices')).toBe(false);
    expect(accountAllowsCapability('no_access', 'manage_billing')).toBe(true);
    expect(policyForAccess('no_access', 'public_booking_pages')).toBe(
      'decision',
    );
    expect(
      accountAllowsCapability('no_access', 'public_booking_pages', {
        treatDecisionAs: 'blocked',
      }),
    ).toBe(false);
  });
});
