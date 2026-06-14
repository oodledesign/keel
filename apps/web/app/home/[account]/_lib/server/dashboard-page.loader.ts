import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { aggregateTransactionsByMonth } from '~/lib/date-range/analytics-date-range';
import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';
import { displayTitle } from '../workspace-content/context-resolve';
import { toIsoDateString } from '../../../_lib/due-date-ymd';

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

export type DashboardNoteSummary = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
};

export type DashboardTaskSummary = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  projectName: string | null;
};

export type DashboardPageData = {
  accountId: string;
  accountSlug: string;
  accountName: string;
  userFirstName: string | null;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  statusSummary: DashboardStatusSummary;
  activeJobsList: DashboardJobSummary[];
  upcomingTasks: DashboardTaskSummary[];
  recentNotes: DashboardNoteSummary[];
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
    name?: string | null;
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
    projectsResult,
    notesResult,
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
      .select('amount_pence, is_transfer')
      .eq('account_id', accountId)
      .gte('transaction_date', monthStartDate),
    client
      .from('finance_transactions')
      .select('transaction_date, amount_pence, is_transfer')
      .eq('account_id', accountId)
      .gte('transaction_date', financeTrendStartIso)
      .order('transaction_date', { ascending: true }),
    client
      .from('projects')
      .select('id, name')
      .eq('account_id', accountId),
    client
      .from('notes')
      .select('id, title, content, updated_at')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(8),
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
    const totals = accumulateFinanceTotals(
      (financeMonthResult.data ?? []).map((row) => ({
        amount_pence: (row.amount_pence as number | null) ?? 0,
        is_transfer: row.is_transfer as boolean | null | undefined,
      })),
    );
    financeIncomePence = totals.incomePence;
    financeExpensePence = totals.expensePence;
  }

  const financeTrend = financeUnavailable
    ? []
    : aggregateTransactionsByMonth(
        (financeTrendResult.data ?? []).map((row) => ({
          transaction_date: row.transaction_date as string,
          amount_pence: (row.amount_pence as number | null) ?? 0,
          is_transfer: row.is_transfer as boolean | null | undefined,
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

  const notesUnavailable = isTableMissingFromApi(notesResult.error);
  const recentNotes: DashboardNoteSummary[] = notesUnavailable
    ? []
    : (notesResult.data ?? []).map((row) => {
        const content = (row.content as string | null) ?? '';
        const titleRaw = (row.title as string | null) ?? '';
        const title = displayTitle(titleRaw, content);
        const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return {
          id: row.id as string,
          title,
          excerpt: plain.slice(0, 120) || 'No content yet',
          updatedAt: row.updated_at as string,
        };
      });

  const projectRows = (projectsResult.data ?? []) as Array<{
    id: string;
    name?: string | null;
  }>;
  const projectIds = projectRows.map((p) => p.id);
  const projectNameMap = new Map(
    projectRows.map((p) => [p.id, p.name ?? 'Project']),
  );

  const { data: jobRowsForTasks } = await client
    .from('jobs')
    .select('id, title')
    .eq('account_id', accountId);
  const jobIds = (jobRowsForTasks ?? []).map((j) => j.id as string);
  const jobNameMap = new Map(
    (jobRowsForTasks ?? []).map((j) => [j.id as string, (j.title as string) ?? 'Project']),
  );

  let upcomingTasks: DashboardTaskSummary[] = [];
  const taskScopeFilters: string[] = [];
  if (jobIds.length > 0) {
    taskScopeFilters.push(`job_id.in.(${jobIds.join(',')})`);
  }
  if (projectIds.length > 0) {
    taskScopeFilters.push(`project_id.in.(${projectIds.join(',')})`);
  }

  if (taskScopeFilters.length > 0) {
    const { data: taskRows, error: tasksError } = await client
      .from('tasks')
      .select('id, title, status, due_date, project_id, job_id')
      .or(taskScopeFilters.join(','))
      .is('parent_task_id', null)
      .not('status', 'eq', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(4);

    if (!isTableMissingFromApi(tasksError) && tasksError) {
      throw tasksError;
    }

    upcomingTasks = (taskRows ?? []).map((t) => ({
      id: t.id as string,
      title: (t.title as string | null) ?? 'Untitled task',
      dueDate: toIsoDateString(t.due_date as string | null | undefined),
      status: (t.status as string | null) ?? 'todo',
      projectName: t.job_id
        ? (jobNameMap.get(t.job_id as string) ?? null)
        : t.project_id
          ? (projectNameMap.get(t.project_id as string) ?? null)
          : null,
    }));
  }

  const accountName =
    account.name?.trim() || account.slug || accountSlug;

  return {
    accountId,
    accountSlug: account.slug ?? accountSlug,
    accountName,
    userFirstName,
    metrics,
    financeTrend,
    statusSummary,
    activeJobsList,
    upcomingTasks,
    recentNotes,
    recentInvoices,
    teamMembers: teamMembers.map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
    })),
  };
}

