import { describe, expect, it } from 'vitest';

import {
  clientSubscriptionStatusLabel,
  mapStripeSubscriptionStatus,
} from '~/lib/billing/client-subscription-status';

describe('mapStripeSubscriptionStatus', () => {
  it('maps Stripe lifecycle statuses into Ozer values', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active');
    expect(mapStripeSubscriptionStatus('trialing')).toBe('active');
    expect(mapStripeSubscriptionStatus('past_due')).toBe('overdue');
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('overdue');
    expect(mapStripeSubscriptionStatus('canceled')).toBe('cancelled');
    expect(mapStripeSubscriptionStatus('incomplete')).toBe('incomplete');
    expect(mapStripeSubscriptionStatus('incomplete_expired')).toBe('cancelled');
  });
});

describe('clientSubscriptionStatusLabel', () => {
  it('shows Past due for overdue', () => {
    expect(clientSubscriptionStatusLabel('overdue')).toBe('Past due');
    expect(clientSubscriptionStatusLabel('active')).toBe('Active');
    expect(clientSubscriptionStatusLabel('cancelled')).toBe('Cancelled');
  });
});
