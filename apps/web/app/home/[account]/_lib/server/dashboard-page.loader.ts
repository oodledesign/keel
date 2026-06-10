import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { aggregateTransactionsByMonth } from '~/lib/date-range/analytics-date-range';

import { loadTeamWorkspace } from './team-account-workspace.loader';
import { redirectIfSpaceNotIn } from './workspace-route-guard';

/** PostgREST returns 404 / schema-cache errors when the table is missing from the API (migrations not applied). */
function isTableMissingFromApi(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

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

export type DashboardFinanceMonth = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  isCurrent: boolean;
};

export type DashboardMetrics = {
  /** Sum of paid invoice totals (pence) for the current calendar month. */
  totalRevenuePence: number;
  /** Finance income (pence) for the current calendar month, when available. */
  financeIncomePence: number;
  financeExpensePence: number;
  financeNetPence: number;
  hasFinanceData: boolean;
  activeProjects: number;
  totalClients: number;
  hoursLogged: number;
};

export type DashboardPageData = {
  accountId: string;
  accountSlug: string;
  userFirstName: string | null;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
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

  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

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

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();
  const monthStartDate = monthStart.toISOString().slice(0, 10);

  const financeTrendStart = new Date();
  financeTrendStart.setMonth(financeTrendStart.getMonth() - 5);
  financeTrendStart.setDate(1);
  const financeTrendStartIso = financeTrendStart.toISOString().slice(0, 10);

  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();

  const [
    activeJobsResult,
    activeProjectsCountResult,
    completedJobsCountResult,
    inProgressJobsCountResult,
    pendingJobsCountResult,
    overdueJobsCountResult,
    clientsCountResult,
    teamMembersResult,
    recentInvoicesResult,
    paidInvoicesMonthResult,
    hoursJobsResult,
    financeMonthResult,
    financeTrendResult,
  ] = await Promise.all([
    client
      .from('jobs')
      .select('id, title, status, priority, due_date, clients(display_name)', {
        count: 'exact',
      })
      .eq('account_id', accountId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(0, 4),
    client
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('status', ['pending', 'in_progress']),
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
      .eq('status', 'pending'),
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
    client
      .from('invoices')
      .select('total_pence')
      .eq('account_id', accountId)
      .eq('status', 'paid')
      .gte('paid_at', monthStartIso),
    client
      .from('jobs')
      .select('actual_minutes')
      .eq('account_id', accountId)
      .gte('updated_at', weekStartIso)
      .not('actual_minutes', 'is', null),
    client
      .from('finance_transactions')
      .select('amount_pence')
      .eq('account_id', accountId)
      .gte('transaction_date', monthStartDate),
    client
      .from('finance_transactions')
      .select('transaction_date, amount_pence')
      .eq('account_id', accountId)
      .gte('transaction_date', financeTrendStartIso)
      .order('transaction_date', { ascending: true }),
  ]);

  const jobsUnavailable = isTableMissingFromApi(activeJobsResult.error);
  const invoicesUnavailable = isTableMissingFromApi(
    recentInvoicesResult.error,
  );
  const financeUnavailable = isTableMissingFromApi(financeMonthResult.error);

  if (activeJobsResult.error && !jobsUnavailable) {
    throw activeJobsResult.error;
  }
  if (recentInvoicesResult.error && !invoicesUnavailable) {
    throw recentInvoicesResult.error;
  }

  if (process.env.NODE_ENV === 'development' && jobsUnavailable) {
    console.warn(
      '[loadDashboardPageData] jobs table unavailable in PostgREST; showing empty job metrics. Run migrations (e.g. 20260216000005_jobs_v1_tables.sql chain) or supabase db push.',
    );
  }
  if (process.env.NODE_ENV === 'development' && invoicesUnavailable) {
    console.warn(
      '[loadDashboardPageData] invoices table unavailable in PostgREST; showing empty invoices. Run migrations (e.g. 20260228120000_invoices_v1_tables.sql chain) or supabase db push.',
    );
  }

  const activeProjectsCount = jobsUnavailable
    ? 0
    : (activeProjectsCountResult.count ?? 0);
  const activeJobsList: DashboardJobSummary[] = (
    jobsUnavailable ? [] : (activeJobsResult.data ?? [])
  ).map((row: any) => ({
    id: row.id as string,
    title: (row.title as string) ?? 'Untitled job',
    clientName: row.clients?.display_name ?? null,
    status: (row.status as string) ?? 'pending',
    priority: (row.priority as string) ?? 'medium',
    dueDate: (row.due_date as string | null) ?? null,
  }));

  const completed = jobsUnavailable
    ? 0
    : (completedJobsCountResult.count ?? 0);
  const inProgress = jobsUnavailable
    ? 0
    : (inProgressJobsCountResult.count ?? 0);
  const pending = jobsUnavailable
    ? 0
    : (pendingJobsCountResult.count ?? 0);
  const overdue = jobsUnavailable
    ? 0
    : (overdueJobsCountResult.count ?? 0);
  const totalClients = clientsCountResult.count ?? 0;

  const totalRevenuePence = invoicesUnavailable
    ? 0
    : (paidInvoicesMonthResult.data ?? []).reduce(
        (sum, row) => sum + ((row.total_pence as number | null) ?? 0),
        0,
      );

  let financeIncomePence = 0;
  let financeExpensePence = 0;
  if (!financeUnavailable) {
    for (const row of financeMonthResult.data ?? []) {
      const pence = (row.amount_pence as number | null) ?? 0;
      if (pence >= 0) financeIncomePence += pence;
      else financeExpensePence += Math.abs(pence);
    }
  }

  const financeTrend = financeUnavailable
    ? []
    : aggregateTransactionsByMonth(
        (financeTrendResult.data ?? []).map((row) => ({
          transaction_date: row.transaction_date as string,
          amount_pence: (row.amount_pence as number | null) ?? 0,
        })),
        6,
      );

  const hasFinanceData =
    !financeUnavailable &&
    ((financeTrendResult.data?.length ?? 0) > 0 ||
      financeIncomePence > 0 ||
      financeExpensePence > 0);

  const hoursLogged = jobsUnavailable
    ? 0
    : Math.round(
        ((hoursJobsResult.data ?? []).reduce(
          (sum, row) => sum + ((row.actual_minutes as number | null) ?? 0),
          0,
        ) /
          60) *
          10,
      ) / 10;

  const metrics: DashboardMetrics = {
    totalRevenuePence,
    financeIncomePence,
    financeExpensePence,
    financeNetPence: financeIncomePence - financeExpensePence,
    hasFinanceData,
    activeProjects: activeProjectsCount,
    totalClients,
    hoursLogged,
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
    invoicesUnavailable ? [] : (recentInvoicesResult.data ?? [])
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
    financeTrend,
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

