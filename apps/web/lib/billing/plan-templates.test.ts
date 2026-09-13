import { describe, expect, it } from 'vitest';

import {
  canActivateClientSubscriptionOffline,
  canResendClientSubscriptionPaymentLink,
  clientSubscriptionBillingLabel,
  formatMinorUnits,
  isOfflineBillingCollection,
  nextBillingDateFromInterval,
  parseBillingCollection,
  planTemplateKindLabel,
} from './plan-templates-types';

describe('plan-templates-types', () => {
  it('formats minor units with interval', () => {
    expect(formatMinorUnits(4500, 'gbp', 'month')).toBe('£45.00/month');
    expect(formatMinorUnits(12000, 'gbp', 'year')).toBe('£120.00/year');
  });

  it('labels kinds in British English product terms', () => {
    expect(planTemplateKindLabel('hosting')).toBe('Hosting');
    expect(planTemplateKindLabel('care_plan')).toBe('Care plan');
  });

  it('parses billing collection and labels offline invoices', () => {
    expect(parseBillingCollection('offline')).toBe('offline');
    expect(parseBillingCollection('stripe')).toBe('stripe');
    expect(parseBillingCollection(null)).toBe('stripe');
    expect(isOfflineBillingCollection('offline')).toBe(true);
    expect(isOfflineBillingCollection('stripe')).toBe(false);
    expect(clientSubscriptionBillingLabel('offline')).toBe('Invoiced offline');
    expect(clientSubscriptionBillingLabel('stripe')).toBeNull();
  });

  it('hides Stripe payment-link actions for offline rows', () => {
    expect(
      canResendClientSubscriptionPaymentLink({
        status: 'pending',
        billingCollection: 'offline',
      }),
    ).toBe(false);
    expect(
      canResendClientSubscriptionPaymentLink({
        status: 'pending',
        billingCollection: 'stripe',
      }),
    ).toBe(true);
    expect(
      canResendClientSubscriptionPaymentLink({
        status: 'active',
        billingCollection: 'stripe',
      }),
    ).toBe(false);
  });

  it('allows offline activation only for pending Stripe setup without a Stripe sub', () => {
    expect(
      canActivateClientSubscriptionOffline({
        status: 'pending',
        billingCollection: 'stripe',
        stripeSubscriptionId: null,
      }),
    ).toBe(true);
    expect(
      canActivateClientSubscriptionOffline({
        status: 'incomplete',
        billingCollection: 'stripe',
      }),
    ).toBe(true);
    expect(
      canActivateClientSubscriptionOffline({
        status: 'active',
        billingCollection: 'offline',
      }),
    ).toBe(false);
    expect(
      canActivateClientSubscriptionOffline({
        status: 'pending',
        stripeSubscriptionId: 'sub_123',
      }),
    ).toBe(false);
  });

  it('advances the next billing date by interval', () => {
    const from = new Date('2026-01-15T12:00:00.000Z');
    expect(nextBillingDateFromInterval('month', from)).toBe(
      '2026-02-15T12:00:00.000Z',
    );
    expect(nextBillingDateFromInterval('year', from)).toBe(
      '2027-01-15T12:00:00.000Z',
    );
  });
});
