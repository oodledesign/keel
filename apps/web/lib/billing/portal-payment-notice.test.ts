import { describe, expect, it } from 'vitest';

import { selectPortalPaymentNotice } from './portal-payment-notice';

describe('selectPortalPaymentNotice', () => {
  it('returns null when nothing needs payment', () => {
    expect(
      selectPortalPaymentNotice([
        {
          id: 'a',
          planName: 'Care',
          status: 'active',
          billingCollection: 'stripe',
        },
        {
          id: 'b',
          planName: 'Offline',
          status: 'pending',
          billingCollection: 'offline',
        },
      ]),
    ).toBeNull();
  });

  it('points Pay now at checkout for a pending Stripe retainer', () => {
    const notice = selectPortalPaymentNotice([
      {
        id: 'sub-1',
        planName: 'Retainer',
        status: 'pending',
        billingCollection: 'stripe',
      },
    ]);

    expect(notice).toEqual({
      kind: 'pending',
      subscriptionId: 'sub-1',
      planName: 'Retainer',
      checkoutHref: '/api/client-subscriptions/checkout?subscriptionId=sub-1',
      extraCount: 0,
    });
  });

  it('prefers a payment issue over a pending setup', () => {
    const notice = selectPortalPaymentNotice([
      {
        id: 'pending',
        planName: 'Setup',
        status: 'incomplete',
        billingCollection: 'stripe',
      },
      {
        id: 'due',
        planName: 'Care plan',
        status: 'overdue',
        billingCollection: 'stripe',
      },
      {
        id: 'due-2',
        planName: 'Hosting',
        status: 'past_due',
        billingCollection: 'stripe',
      },
    ]);

    expect(notice?.kind).toBe('issue');
    expect(notice?.subscriptionId).toBe('due');
    expect(notice?.checkoutHref).toBeNull();
    expect(notice?.extraCount).toBe(1);
  });

  it('ignores offline overdue rows', () => {
    expect(
      selectPortalPaymentNotice([
        {
          id: 'off',
          planName: 'Invoice',
          status: 'overdue',
          billingCollection: 'offline',
        },
      ]),
    ).toBeNull();
  });
});
