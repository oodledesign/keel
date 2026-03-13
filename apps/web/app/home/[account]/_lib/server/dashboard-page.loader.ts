import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from './team-account-workspace.loader';

export type DashboardStatusSummary = {
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
};

export type DashboardJobSummary = {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
};

export type DashboardInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  clientName: string | null;
  totalPence: number;
  dueAt: string | null;
  status: string;
};

export type DashboardMetrics = {
  totalRevenue: number;
  activeJobs: number;
  totalClients: number;
  hoursLogged: number;
};

export type DashboardPageData = {
  accountId: string;
  accountSlug: string;
  userFirstName: string | null;
  metrics: DashboardMetrics;
  statusSummary: DashboardStatusSummary;
  activeJobsList: DashboardJobSummary[];
  recentInvoices: DashboardInvoiceSummary[];
  teamMembers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;
};

export async function loadDashboardPageData(
  accountSlug: string,
): Promise<DashboardPageData> {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  const account = workspace.account as {
    id: string;
    slug: string | null;
  };

  const user = workspace.user as {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };

  const toFirstName = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const base = raw.split(' ')[0] ?? raw;
    if (!base) return null;
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  let userFirstName: string | null = null;
  if (user?.user_metadata && typeof user.user_metadata === 'object') {
    const meta = user.user_metadata as Record<string, unknown>;
    const rawMeta =
      (typeof meta.first_name === 'string' && meta.first_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      null;
    userFirstName = toFirstName(rawMeta);
  }
  if (!userFirstName && user?.email) {
    const localPart = user.email.split('@')[0] ?? user.email;
    userFirstName = toFirstName(localPart);
  }

  const client = getSupabaseServerClient();
  const accountId = account.id;

  const todayIso = new Date().toISOString().slice(0, 10);

  const [
    activeJobsResult,
    completedJobsCountResult,
    inProgressJobsCountResult,
    pendingJobsCountResult,
    overdueJobsCountResult,
    clientsCountResult,
    teamMembersResult,
    recentInvoicesResult,
  ] = await Promise.all([
    client
      .from('jobs')
      .select('id, title, status, priority, due_date, clients(display_name)', {
        count: 'exact',
      })
      .eq('account_id', accountId)
      .not('status', 'in', '("completed","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(0, 4),
    client
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'completed'),
    client
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'in_progress'),
    client
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('status', ['pending', 'on_hold']),
    client
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .lt('due_date', todayIso)
      .not('status', 'in', '("completed","cancelled")'),
    client
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId),
    client.rpc('get_account_members', {
      account_slug: account.slug ?? accountSlug,
    }),
    client
      .from('invoices')
      .select(
        'id, invoice_number, total_pence, due_at, status, clients(display_name)',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (activeJobsResult.error) {
    throw activeJobsResult.error;
  }

  const activeJobsCount = activeJobsResult.count ?? 0;
  const activeJobsList: DashboardJobSummary[] = (activeJobsResult.data ??
    []
  ).map((row: any) => ({
    id: row.id as string,
    title: (row.title as string) ?? 'Untitled job',
    clientName: row.clients?.display_name ?? null,
    status: (row.status as string) ?? 'pending',
    priority: (row.priority as string) ?? 'medium',
    dueDate: (row.due_date as string | null) ?? null,
  }));

  const completed = completedJobsCountResult.count ?? 0;
  const inProgress = inProgressJobsCountResult.count ?? 0;
  const pending = pendingJobsCountResult.count ?? 0;
  const overdue = overdueJobsCountResult.count ?? 0;
  const totalClients = clientsCountResult.count ?? 0;

  const metrics: DashboardMetrics = {
    // Placeholder values for now; will be wired to real data later.
    totalRevenue: 48392,
    activeJobs: activeJobsCount,
    totalClients,
    hoursLogged: 342,
  };

  const statusSummary: DashboardStatusSummary = {
    completed,
    inProgress,
    pending,
    overdue,
  };

  const orderedRoles: string[] = [
    'admin',
    'owner',
    'staff',
    'contractor',
  ];

  const teamMembersRaw = (teamMembersResult.data ?? []) as Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;

  const teamMembers = [...teamMembersRaw].sort((a, b) => {
    const aIndex = orderedRoles.indexOf((a.role ?? '').toLowerCase());
    const bIndex = orderedRoles.indexOf((b.role ?? '').toLowerCase());
    const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const recentInvoices: DashboardInvoiceSummary[] = (
    recentInvoicesResult.data ?? []
  ).map((row: any) => ({
    id: (row.invoice_number as string) ?? (row.id as string),
    invoiceNumber: (row.invoice_number as string) ?? (row.id as string),
    clientName: row.clients?.display_name ?? null,
    totalPence: (row.total_pence as number | null) ?? 0,
    dueAt: (row.due_at as string | null) ?? null,
    status: (row.status as string | null) ?? 'draft',
  }));

  return {
    accountId,
    accountSlug: account.slug ?? accountSlug,
    userFirstName,
    metrics,
    statusSummary,
    activeJobsList,
    recentInvoices,
    teamMembers: teamMembers.map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
    })),
  };
}

