import { describe, expect, it } from 'vitest';

import type { ClientSubscriptionRecord } from '~/lib/billing/plan-templates-types';

import {
  buildWorkspaceRetainerRows,
  filterWorkspaceRetainerRows,
  monthlyEquivalentPence,
  retainerFilterStatus,
  summarizeWorkspaceRetainers,
  workspaceRetainersHref,
} from './workspace-retainers';

function sub(
  overrides: Partial<ClientSubscriptionRecord>,
): ClientSubscriptionRecord {
  return {
    id: 'sub-1',
    accountId: 'acc',
    businessId: null,
    clientId: 'client-1',
    clientOrgId: null,
    websiteId: null,
    projectId: 'proj-1',
    planTemplateId: 'plan-1',
    planName: 'Care',
    subscriptionKind: 'retainer',
    monthlyAmount: 15000,
    currency: 'gbp',
    status: 'active',
    billingCollection: 'stripe',
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    stripePriceId: null,
    stripePaymentLink: null,
    stripeCheckoutSessionId: null,
    currentPeriodEnd: null,
    nextBillingDate: '2026-10-01T00:00:00.000Z',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const clients = [
  { id: 'client-1', name: 'Acme' },
  { id: 'client-2', name: 'Birch' },
];

const projects = [
  { id: 'proj-1', title: 'Site', clientId: 'client-1' },
  { id: 'proj-2', title: 'Brand', clientId: 'client-2' },
  { id: 'proj-3', title: 'Idle', clientId: 'client-1' },
];

describe('workspace retainers', () => {
  it('maps live, pending, and cancelled into filter statuses', () => {
    expect(retainerFilterStatus('active')).toBe('active');
    expect(retainerFilterStatus('overdue')).toBe('active');
    expect(retainerFilterStatus('pending')).toBe('pending');
    expect(retainerFilterStatus('incomplete')).toBe('pending');
    expect(retainerFilterStatus('cancelled')).toBe('cancelled');
  });

  it('converts yearly amounts to monthly equivalents', () => {
    expect(monthlyEquivalentPence(120000, 'year')).toBe(10000);
    expect(monthlyEquivalentPence(15000, 'month')).toBe(15000);
  });

  it('builds project rows and skips website hosting plans', () => {
    const result = buildWorkspaceRetainerRows({
      clients,
      projects,
      balances: new Map([['proj-3', 8]]),
      intervals: new Map([['plan-1', 'month']]),
      subscriptions: [
        sub({ id: 'live' }),
        sub({
          id: 'pending',
          projectId: 'proj-2',
          clientId: 'client-2',
          status: 'pending',
          monthlyAmount: 20000,
          planName: 'Brand care',
        }),
        sub({
          id: 'hosting',
          websiteId: 'web-1',
          projectId: null,
          planName: 'Hosting',
        }),
      ],
    });

    expect(result.rows.map((row) => row.id)).toEqual([
      'pending',
      'credits:proj-3',
      'live',
    ]);
    expect(result.rows[0]).toMatchObject({
      clientName: 'Birch',
      projectTitle: 'Brand',
      filterStatus: 'pending',
      canPay: true,
    });
    expect(
      result.rows.find((row) => row.id === 'credits:proj-3'),
    ).toMatchObject({
      planName: 'Credits only',
      creditBalance: 8,
      projectTitle: 'Idle',
      filterStatus: 'active',
    });
    expect(result.projects).toEqual([
      {
        projectId: 'proj-2',
        projectTitle: 'Brand',
        clientId: 'client-2',
        hasPlan: true,
      },
      {
        projectId: 'proj-3',
        projectTitle: 'Idle',
        clientId: 'client-1',
        hasPlan: false,
      },
      {
        projectId: 'proj-1',
        projectTitle: 'Site',
        clientId: 'client-1',
        hasPlan: true,
      },
    ]);
  });

  it('keeps cancelled plans in the list and still marks the project as attachable', () => {
    const result = buildWorkspaceRetainerRows({
      clients,
      projects,
      balances: new Map([['proj-1', 4]]),
      subscriptions: [
        sub({ id: 'gone', status: 'cancelled', nextBillingDate: null }),
      ],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      filterStatus: 'cancelled',
      creditBalance: 4,
      canPay: false,
    });
    expect(
      result.projects.find((row) => row.projectId === 'proj-1')?.hasPlan,
    ).toBe(false);
  });

  it('filters by status and client search', () => {
    const { rows } = buildWorkspaceRetainerRows({
      clients,
      projects,
      balances: new Map(),
      subscriptions: [
        sub({ id: 'live' }),
        sub({
          id: 'pending',
          projectId: 'proj-2',
          clientId: 'client-2',
          status: 'incomplete',
          planName: 'Brand care',
        }),
      ],
    });

    expect(
      filterWorkspaceRetainerRows(rows, { status: 'pending' }).map(
        (row) => row.id,
      ),
    ).toEqual(['pending']);
    expect(
      filterWorkspaceRetainerRows(rows, { query: 'birch' }).map(
        (row) => row.id,
      ),
    ).toEqual(['pending']);
    expect(
      filterWorkspaceRetainerRows(rows, { query: 'site' }).map((row) => row.id),
    ).toEqual(['live']);
  });

  it('summarises MRR, pending awaiting payment, and top retainers', () => {
    const { rows } = buildWorkspaceRetainerRows({
      clients,
      projects,
      balances: new Map(),
      intervals: new Map([
        ['plan-1', 'month'],
        ['plan-year', 'year'],
      ]),
      subscriptions: [
        sub({ id: 'live-a', monthlyAmount: 15000 }),
        sub({
          id: 'live-year',
          projectId: 'proj-3',
          planTemplateId: 'plan-year',
          monthlyAmount: 120000,
          planName: 'Annual',
        }),
        sub({
          id: 'pending',
          projectId: 'proj-2',
          clientId: 'client-2',
          status: 'pending',
          monthlyAmount: 20000,
        }),
        sub({
          id: 'offline-pending',
          projectId: null,
          clientId: 'client-1',
          status: 'pending',
          billingCollection: 'offline',
        }),
      ],
    });

    const summary = summarizeWorkspaceRetainers(rows, { topLimit: 3 });
    expect(summary.activeCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.mrrPence).toBe(25000);
    expect(summary.pending.map((row) => row.id)).toEqual(['pending']);
    expect(summary.top.map((row) => row.id)).toEqual([
      'live-a',
      'live-year',
      'pending',
    ]);
  });

  it('deep-links the workspace retainers page', () => {
    expect(workspaceRetainersHref('acme')).toBe('/app/acme/retainers');
    expect(workspaceRetainersHref('acme', { status: 'pending' })).toBe(
      '/app/acme/retainers?status=pending',
    );
  });
});
