import { describe, expect, it } from 'vitest';

import type { ClientSubscriptionRecord } from '~/lib/billing/plan-templates-types';

import {
  buildClientRetainerSummary,
  pickPrimarySubscription,
  projectRetainerHref,
} from './client-retainer-summary';

function sub(
  overrides: Partial<ClientSubscriptionRecord>,
): ClientSubscriptionRecord {
  return {
    id: 'sub-1',
    accountId: 'acc',
    businessId: null,
    clientId: 'client',
    clientOrgId: null,
    websiteId: null,
    projectId: null,
    planTemplateId: null,
    planName: 'Care',
    subscriptionKind: 'retainer',
    monthlyAmount: 15000,
    currency: 'gbp',
    status: 'pending',
    billingCollection: 'stripe',
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    stripePriceId: null,
    stripePaymentLink: null,
    stripeCheckoutSessionId: null,
    currentPeriodEnd: null,
    nextBillingDate: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('client retainer summary', () => {
  it('builds project rows from credits or a linked plan', () => {
    const result = buildClientRetainerSummary({
      projects: [
        { id: 'p1', title: 'Site', status: 'active' },
        { id: 'p2', title: 'Brand', status: 'active' },
        { id: 'p3', title: 'Idle', status: 'active' },
      ],
      balances: new Map([['p1', 12]]),
      subscriptions: [
        sub({ id: 's2', projectId: 'p2', status: 'incomplete' }),
        sub({ id: 'legacy', projectId: null, status: 'active' }),
      ],
    });

    expect(result.projects).toEqual([
      {
        projectId: 'p1',
        projectTitle: 'Site',
        projectStatus: 'active',
        creditBalance: 12,
        planName: null,
        planStatus: null,
        subscriptionId: null,
        canPay: false,
      },
      {
        projectId: 'p2',
        projectTitle: 'Brand',
        projectStatus: 'active',
        creditBalance: null,
        planName: 'Care',
        planStatus: 'incomplete',
        subscriptionId: 's2',
        canPay: true,
      },
    ]);
    expect(result.unassigned).toHaveLength(1);
    expect(result.unassigned[0]?.subscriptionId).toBe('legacy');
  });

  it('hides a project whose only plan is cancelled unless credits remain', () => {
    const empty = buildClientRetainerSummary({
      projects: [{ id: 'p1', title: 'Site', status: 'active' }],
      balances: new Map(),
      subscriptions: [
        sub({ id: 'gone', projectId: 'p1', status: 'cancelled' }),
      ],
    });
    expect(empty.projects).toEqual([]);

    const withCredits = buildClientRetainerSummary({
      projects: [{ id: 'p1', title: 'Site', status: 'active' }],
      balances: new Map([['p1', 4]]),
      subscriptions: [
        sub({ id: 'gone', projectId: 'p1', status: 'cancelled' }),
      ],
    });
    expect(withCredits.projects).toEqual([
      {
        projectId: 'p1',
        projectTitle: 'Site',
        projectStatus: 'active',
        creditBalance: 4,
        planName: 'Care',
        planStatus: 'cancelled',
        subscriptionId: 'gone',
        canPay: false,
      },
    ]);
  });

  it('prefers a live plan over pending when both exist', () => {
    expect(
      pickPrimarySubscription([
        sub({ id: 'pend', status: 'pending' }),
        sub({ id: 'live', status: 'active' }),
      ])?.id,
    ).toBe('live');
  });

  it('deep-links to the project retainer tab', () => {
    expect(projectRetainerHref('acme', 'proj-1')).toBe(
      '/app/acme/projects/proj-1?tab=services',
    );
  });
});
