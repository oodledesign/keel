import pathsConfig from '~/config/paths.config';
import {
  canPayClientSubscription,
  isLiveClientSubscriptionStatus,
  isPendingClientSubscriptionStatus,
} from '~/lib/billing/client-subscription-lifecycle';
import type {
  ClientSubscriptionRecord,
  PlanBillingInterval,
} from '~/lib/billing/plan-templates-types';

export type WorkspaceRetainerStatusFilter =
  | 'all'
  | 'active'
  | 'pending'
  | 'cancelled';

export type WorkspaceRetainerFilterStatus = Exclude<
  WorkspaceRetainerStatusFilter,
  'all'
>;

export type WorkspaceRetainerRow = {
  id: string;
  subscriptionId: string | null;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectTitle: string | null;
  planName: string;
  status: ClientSubscriptionRecord['status'] | null;
  filterStatus: WorkspaceRetainerFilterStatus;
  amountPence: number;
  currency: string;
  interval: PlanBillingInterval;
  creditBalance: number | null;
  nextBillingDate: string | null;
  canPay: boolean;
};

export type WorkspaceRetainerClientChoice = {
  clientId: string;
  clientName: string;
};

export type WorkspaceRetainerProjectChoice = {
  projectId: string;
  projectTitle: string;
  clientId: string | null;
  hasPlan: boolean;
};

export type WorkspaceRetainersSummary = {
  activeCount: number;
  pendingCount: number;
  mrrPence: number;
  currency: string;
  pending: WorkspaceRetainerRow[];
  top: WorkspaceRetainerRow[];
};

const STATUS_RANK: Record<WorkspaceRetainerFilterStatus, number> = {
  pending: 0,
  active: 1,
  cancelled: 2,
};

export function workspaceRetainersHref(
  accountSlug: string,
  options?: { status?: WorkspaceRetainerStatusFilter },
) {
  const href = pathsConfig.app.accountRetainers.replace(
    '[account]',
    accountSlug,
  );
  if (options?.status && options.status !== 'all') {
    return `${href}?status=${options.status}`;
  }
  return href;
}

export function retainerFilterStatus(
  status: string | null | undefined,
): WorkspaceRetainerFilterStatus {
  if (status === 'cancelled') return 'cancelled';
  if (isPendingClientSubscriptionStatus(status)) return 'pending';
  return 'active';
}

export function monthlyEquivalentPence(
  amountPence: number,
  interval: PlanBillingInterval,
) {
  if (!Number.isFinite(amountPence) || amountPence <= 0) return 0;
  return interval === 'year' ? Math.round(amountPence / 12) : amountPence;
}

export function parsePlanBillingInterval(value: unknown): PlanBillingInterval {
  return value === 'year' ? 'year' : 'month';
}

function compareRows(a: WorkspaceRetainerRow, b: WorkspaceRetainerRow) {
  const statusDelta = STATUS_RANK[a.filterStatus] - STATUS_RANK[b.filterStatus];
  if (statusDelta !== 0) return statusDelta;
  const clientDelta = a.clientName.localeCompare(b.clientName, 'en', {
    sensitivity: 'base',
  });
  if (clientDelta !== 0) return clientDelta;
  return (a.projectTitle ?? '').localeCompare(b.projectTitle ?? '', 'en', {
    sensitivity: 'base',
  });
}

export function buildWorkspaceRetainerRows(input: {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string | null }>;
  balances: Map<string, number>;
  subscriptions: ClientSubscriptionRecord[];
  intervals?: Map<string, PlanBillingInterval>;
}): {
  rows: WorkspaceRetainerRow[];
  clients: WorkspaceRetainerClientChoice[];
  projects: WorkspaceRetainerProjectChoice[];
} {
  const clientNames = new Map(
    input.clients.map((row) => [row.id, row.name] as const),
  );
  const projectsById = new Map(input.projects.map((row) => [row.id, row]));
  const liveByProject = new Set<string>();
  const listedProjects = new Set<string>();

  const rows: WorkspaceRetainerRow[] = [];

  for (const sub of input.subscriptions) {
    if (sub.websiteId) continue;

    const project = sub.projectId
      ? (projectsById.get(sub.projectId) ?? null)
      : null;
    const clientId = sub.clientId ?? project?.clientId ?? null;
    const interval = sub.planTemplateId
      ? (input.intervals?.get(sub.planTemplateId) ?? 'month')
      : 'month';
    const creditBalance =
      sub.projectId && input.balances.has(sub.projectId)
        ? (input.balances.get(sub.projectId) ?? 0)
        : null;

    if (sub.projectId) {
      listedProjects.add(sub.projectId);
      if (sub.status !== 'cancelled') {
        liveByProject.add(sub.projectId);
      }
    }

    rows.push({
      id: sub.id,
      subscriptionId: sub.id,
      clientId,
      clientName: (clientId && clientNames.get(clientId)) || 'Client',
      projectId: sub.projectId,
      projectTitle: project?.title ?? null,
      planName: sub.planName?.trim() || 'Retainer',
      status: sub.status,
      filterStatus: retainerFilterStatus(sub.status),
      amountPence: Number.isFinite(sub.monthlyAmount) ? sub.monthlyAmount : 0,
      currency: sub.currency || 'gbp',
      interval,
      creditBalance,
      nextBillingDate: sub.nextBillingDate ?? sub.currentPeriodEnd,
      canPay: canPayClientSubscription({
        status: sub.status,
        billingCollection: sub.billingCollection,
      }),
    });
  }

  for (const project of input.projects) {
    if (listedProjects.has(project.id)) continue;
    if (!input.balances.has(project.id)) continue;
    const balance = input.balances.get(project.id) ?? 0;
    rows.push({
      id: `credits:${project.id}`,
      subscriptionId: null,
      clientId: project.clientId,
      clientName:
        (project.clientId && clientNames.get(project.clientId)) || 'Client',
      projectId: project.id,
      projectTitle: project.title,
      planName: 'Credits only',
      status: null,
      filterStatus: 'active',
      amountPence: 0,
      currency: 'gbp',
      interval: 'month',
      creditBalance: balance,
      nextBillingDate: null,
      canPay: false,
    });
  }

  const clients = [...input.clients]
    .map((row) => ({
      clientId: row.id,
      clientName: row.name,
    }))
    .sort((a, b) =>
      a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' }),
    );

  const projects = input.projects
    .map((project) => ({
      projectId: project.id,
      projectTitle: project.title,
      clientId: project.clientId,
      hasPlan: liveByProject.has(project.id),
    }))
    .sort((a, b) =>
      a.projectTitle.localeCompare(b.projectTitle, 'en', {
        sensitivity: 'base',
      }),
    );

  return {
    rows: rows.sort(compareRows),
    clients,
    projects,
  };
}

export function filterWorkspaceRetainerRows(
  rows: WorkspaceRetainerRow[],
  input: {
    status?: WorkspaceRetainerStatusFilter;
    query?: string;
  },
) {
  const status = input.status ?? 'all';
  const query = input.query?.trim().toLowerCase() ?? '';

  return rows.filter((row) => {
    if (status !== 'all' && row.filterStatus !== status) return false;
    if (!query) return true;
    return (
      row.clientName.toLowerCase().includes(query) ||
      (row.projectTitle?.toLowerCase().includes(query) ?? false) ||
      row.planName.toLowerCase().includes(query)
    );
  });
}

export function summarizeWorkspaceRetainers(
  rows: WorkspaceRetainerRow[],
  options?: { topLimit?: number },
): WorkspaceRetainersSummary {
  const topLimit = options?.topLimit ?? 5;
  const live = rows.filter((row) => isLiveClientSubscriptionStatus(row.status));
  const pending = rows.filter((row) => row.canPay);
  const currency = live[0]?.currency ?? pending[0]?.currency ?? 'gbp';
  const mrrPence = live.reduce(
    (sum, row) => sum + monthlyEquivalentPence(row.amountPence, row.interval),
    0,
  );

  const top = [...live, ...pending]
    .filter(
      (row, index, list) =>
        list.findIndex((item) => item.id === row.id) === index,
    )
    .sort((a, b) => {
      const aLive = isLiveClientSubscriptionStatus(a.status) ? 0 : 1;
      const bLive = isLiveClientSubscriptionStatus(b.status) ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return (
        monthlyEquivalentPence(b.amountPence, b.interval) -
        monthlyEquivalentPence(a.amountPence, a.interval)
      );
    })
    .slice(0, topLimit);

  return {
    activeCount: live.length,
    pendingCount: pending.length,
    mrrPence,
    currency,
    pending,
    top,
  };
}
