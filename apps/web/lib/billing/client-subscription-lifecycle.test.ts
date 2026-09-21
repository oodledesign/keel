import { describe, expect, it } from 'vitest';

import {
  canPayClientSubscription,
  canRemoveClientSubscription,
  clientSubscriptionCheckoutHref,
  isPendingClientSubscriptionStatus,
  isRemovedClientSubscriptionStatus,
  isVisibleAgencyClientSubscription,
  portalBillingReturnPath,
  selectPortalPlanSubscriptions,
} from './client-subscription-lifecycle';

describe('client subscription lifecycle', () => {
  it('treats pending and incomplete as unpaid setup', () => {
    expect(isPendingClientSubscriptionStatus('pending')).toBe(true);
    expect(isPendingClientSubscriptionStatus('incomplete')).toBe(true);
    expect(isPendingClientSubscriptionStatus('active')).toBe(false);
    expect(isPendingClientSubscriptionStatus('cancelled')).toBe(false);
  });

  it('lets clients pay unpaid Stripe retainers only', () => {
    expect(
      canPayClientSubscription({
        status: 'pending',
        billingCollection: 'stripe',
      }),
    ).toBe(true);
    expect(
      canPayClientSubscription({
        status: 'incomplete',
        billingCollection: 'stripe',
      }),
    ).toBe(true);
    expect(
      canPayClientSubscription({
        status: 'pending',
        billingCollection: 'offline',
      }),
    ).toBe(false);
    expect(
      canPayClientSubscription({
        status: 'active',
        billingCollection: 'stripe',
      }),
    ).toBe(false);
    expect(
      canPayClientSubscription({
        status: 'cancelled',
        billingCollection: 'stripe',
      }),
    ).toBe(false);
  });

  it('hides cancelled retainers from agency live list and portal plans', () => {
    expect(isRemovedClientSubscriptionStatus('cancelled')).toBe(true);
    expect(canRemoveClientSubscription('pending')).toBe(true);
    expect(canRemoveClientSubscription('active')).toBe(true);
    expect(canRemoveClientSubscription('cancelled')).toBe(false);
    expect(isVisibleAgencyClientSubscription('pending')).toBe(true);
    expect(isVisibleAgencyClientSubscription('cancelled')).toBe(false);
  });

  it('reuses the existing checkout route for Pay now', () => {
    expect(clientSubscriptionCheckoutHref('sub-1')).toBe(
      '/api/client-subscriptions/checkout?subscriptionId=sub-1',
    );
    expect(portalBillingReturnPath('acme', 'paid')).toBe(
      '/portal/acme/billing?paid=1',
    );
    expect(portalBillingReturnPath('acme', 'cancelled')).toBe(
      '/portal/acme/billing?checkout=cancelled',
    );
  });

  it('selects live plan separately from payable pending retainers', () => {
    const rows = [
      { id: 'cancelled', status: 'cancelled', billingCollection: 'stripe' },
      { id: 'pending-a', status: 'pending', billingCollection: 'stripe' },
      { id: 'pending-b', status: 'incomplete', billingCollection: 'stripe' },
      { id: 'offline', status: 'pending', billingCollection: 'offline' },
      { id: 'live', status: 'active', billingCollection: 'stripe' },
    ];

    expect(selectPortalPlanSubscriptions(rows)).toEqual({
      active: rows[4],
      pending: [rows[1], rows[2]],
    });
  });

  it('does not treat a cancelled latest row as the current plan', () => {
    expect(
      selectPortalPlanSubscriptions([
        { id: 'old', status: 'cancelled', billingCollection: 'stripe' },
      ]),
    ).toEqual({ active: null, pending: [] });
  });

  it('documents remove: live/pending become cancelled and drop off portal + agency lists', () => {
    for (const status of ['pending', 'incomplete', 'active', 'overdue']) {
      expect(canRemoveClientSubscription(status)).toBe(true);
    }

    expect(
      canPayClientSubscription({
        status: 'cancelled',
        billingCollection: 'stripe',
      }),
    ).toBe(false);
    expect(isVisibleAgencyClientSubscription('cancelled')).toBe(false);
    expect(
      selectPortalPlanSubscriptions([
        { id: 'removed', status: 'cancelled', billingCollection: 'stripe' },
        { id: 'next', status: 'pending', billingCollection: 'stripe' },
      ]),
    ).toEqual({
      active: null,
      pending: [{ id: 'next', status: 'pending', billingCollection: 'stripe' }],
    });
  });
});
