import pathsConfig from '~/config/paths.config';
import { canPayClientSubscription } from '~/lib/billing/client-subscription-lifecycle';
import type { ClientSubscriptionRecord } from '~/lib/billing/plan-templates-types';

export type ClientProjectRetainerSummary = {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  creditBalance: number | null;
  planName: string | null;
  planStatus: string | null;
  subscriptionId: string | null;
  canPay: boolean;
};

export type UnassignedClientRetainer = {
  subscriptionId: string;
  planName: string;
  planStatus: string;
  monthlyAmount: number;
  currency: string;
  canPay: boolean;
};

export function projectRetainerHref(accountSlug: string, projectId: string) {
  return `${pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', projectId)}?tab=services`;
}

export function pickPrimarySubscription(
  rows: ClientSubscriptionRecord[],
): ClientSubscriptionRecord | null {
  const live = rows.find(
    (row) => row.status === 'active' || row.status === 'overdue',
  );
  if (live) return live;
  const pending = rows.find(
    (row) => row.status === 'pending' || row.status === 'incomplete',
  );
  if (pending) return pending;
  return rows[0] ?? null;
}

export function buildClientRetainerSummary(input: {
  projects: Array<{ id: string; title: string; status: string }>;
  balances: Map<string, number>;
  subscriptions: ClientSubscriptionRecord[];
}): {
  projects: ClientProjectRetainerSummary[];
  unassigned: UnassignedClientRetainer[];
} {
  const byProject = new Map<string, ClientSubscriptionRecord[]>();
  const unassignedSubs: ClientSubscriptionRecord[] = [];

  for (const sub of input.subscriptions) {
    if (sub.websiteId) continue;
    if (sub.projectId) {
      const list = byProject.get(sub.projectId) ?? [];
      list.push(sub);
      byProject.set(sub.projectId, list);
    } else {
      unassignedSubs.push(sub);
    }
  }

  const projects = input.projects
    .map((project) => {
      const subs = byProject.get(project.id) ?? [];
      const primary = pickPrimarySubscription(subs);
      const balance = input.balances.has(project.id)
        ? (input.balances.get(project.id) ?? 0)
        : null;
      const hasRetainer = Boolean(primary) || balance != null;

      if (!hasRetainer) return null;

      return {
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        creditBalance: balance,
        planName: primary?.planName ?? null,
        planStatus: primary?.status ?? null,
        subscriptionId: primary?.id ?? null,
        canPay: primary
          ? canPayClientSubscription({
              status: primary.status,
              billingCollection: primary.billingCollection,
            })
          : false,
      } satisfies ClientProjectRetainerSummary;
    })
    .filter((row): row is ClientProjectRetainerSummary => row !== null);

  const unassigned = unassignedSubs
    .filter((row) => row.status !== 'cancelled')
    .map((row) => ({
      subscriptionId: row.id,
      planName: row.planName?.trim() || 'Subscription',
      planStatus: row.status,
      monthlyAmount: row.monthlyAmount,
      currency: row.currency,
      canPay: canPayClientSubscription({
        status: row.status,
        billingCollection: row.billingCollection,
      }),
    }));

  return { projects, unassigned };
}
