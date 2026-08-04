import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { aggregateTransactionsByMonth } from '~/lib/date-range/analytics-date-range';
import { loadSuggestedEmailActionItems } from '~/lib/email-assistant/suggested-email-tasks.loader';
import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';

import { toIsoDateString } from '../../../_lib/due-date-ymd';
import {
  displayTitle,
  resolveNoteAssignmentLabels,
} from '../workspace-content/context-resolve';
import { loadTeamWorkspace } from './team-account-workspace.loader';
import { redirectIfSpaceNotIn } from './workspace-route-guard';

/** PostgREST returns 404 / schema-cache errors when the table is missing from the API (migrations not applied). */
function isTableMissingFromApi(
  error: {
    message?: string;
    code?: string;
  } | null,
): boolean {
  if (!error) return false;
  // PGRST200 = missing relationship (query bug) — do not treat as missing table.
  if (error.code === 'PGRST200') return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    m.includes('could not find the table') ||
    (m.includes('does not exist') && m.includes('relation'))
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
  clientName: string | null;
  projectName: string | null;
};

export type DashboardTaskSummary = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  projectName: string | null;
};

export type DashboardNeedsReplyThread = {
  id: string;
  subject: string;
  snippet: string | null;
  fromLabel: string;
  lastMessageAt: string | null;
  clientName: string | null;
};

export type DashboardNeedsReplySummary = {
  threads: DashboardNeedsReplyThread[];
  totalCount: number;
};

export type DashboardSuggestedEmailTask = {
  id: string;
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
  threadId: string;
  threadSubject: string;
  emailSentAt: string | null;
};

export type DashboardSuggestedEmailTasksSummary = {
  items: DashboardSuggestedEmailTask[];
  totalCount: number;
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
  needsReply: DashboardNeedsReplySummary;
  suggestedEmailTasks: DashboardSuggestedEmailTasksSummary;
  recentNotes: DashboardNoteSummary[];
  recentInvoices: DashboardInvoiceSummary[];
  teamMembers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;
};

export const loadDashboardPageData = cache(loadDashboardPageDataImpl);

async function loadDashboardPageDataImpl(
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
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };

  const userId = user.id;

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

  // Do not call Gmail from the dashboard — refreshing needs_reply threads via
  // the Gmail API can take 10–20s+ and blocks first paint. Cron + email inbox
  // keep categories fresh; dashboard only reads what is already synced.

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
    activeProjectsCountResult,
    clientsCountResult,
    paidInvoicesMonthResult,
    hoursJobsResult,
    financeMonthResult,
    financeTrendResult,
    notesResult,
    businessConnectionResult,
    upcomingTasksResult,
    suggestedEmailLoaded,
  ] = await Promise.all([
    client
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .in('status', ['pending', 'in_progress']),
    client
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId),
    client
      .from('invoices')
      .select('total_pence')
      .eq('account_id', accountId)
      .eq('status', 'paid')
      .gte('paid_at', monthStartIso),
    client
      .from('projects')
      .select('actual_minutes')
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
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
      .from('notes')
      .select(
        'id, title, content, updated_at, client_id, client_org_id, project_id, clients(display_name), client_orgs(name), projects(name, title)',
      )
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(8),
    userId
      ? client
          .from('google_connections')
          .select('id')
          .eq('user_id', userId)
          .eq('mailbox_kind', 'business')
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from('tasks')
      .select(
        'id, title, status, due_date, project_id, client_id, projects(name, title)',
      )
      .eq('account_id', accountId)
      .is('parent_task_id', null)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(4),
    userId
      ? loadSuggestedEmailActionItems(client, userId, {
          accountId,
          limit: 5,
        })
      : Promise.resolve({ items: [], totalCount: 0 }),
  ]);

  const businessConnectionId =
    (businessConnectionResult.data as { id?: string } | null)?.id ?? null;

  const needsReplyResult = businessConnectionId
    ? await client
        .from('email_threads')
        .select(
          'id, subject, snippet, participants, last_message_at, client_id',
          {
            count: 'exact',
          },
        )
        .eq('user_id', userId ?? '')
        .eq('connection_id', businessConnectionId)
        .eq('assistant_category', 'needs_reply')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(8)
    : { data: [], count: 0, error: null };

  const jobsUnavailable = isTableMissingFromApi(
    activeProjectsCountResult.error,
  );
  const invoicesUnavailable = isTableMissingFromApi(
    paidInvoicesMonthResult.error,
  );
  const financeUnavailable = isTableMissingFromApi(financeMonthResult.error);

  if (activeProjectsCountResult.error && !jobsUnavailable) {
    throw activeProjectsCountResult.error;
  }
  if (paidInvoicesMonthResult.error && !invoicesUnavailable) {
    throw paidInvoicesMonthResult.error;
  }

  if (process.env.NODE_ENV === 'development' && jobsUnavailable) {
    console.warn(
      '[loadDashboardPageData] projects table unavailable in PostgREST; showing empty job metrics. Run migrations or supabase db push.',
    );
  }
  if (process.env.NODE_ENV === 'development' && invoicesUnavailable) {
    console.warn(
      '[loadDashboardPageData] invoices table unavailable in PostgREST; showing empty invoices. Run migrations or supabase db push.',
    );
  }

  const activeProjectsCount = jobsUnavailable
    ? 0
    : (activeProjectsCountResult.count ?? 0);

  const statusSummary: DashboardStatusSummary = {
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
  };

  const activeJobsList: DashboardJobSummary[] = [];

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

  const totalClients = clientsCountResult.count ?? 0;

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

  const notesUnavailable = isTableMissingFromApi(notesResult.error);
  const recentNotes: DashboardNoteSummary[] = notesUnavailable
    ? []
    : (notesResult.data ?? []).map((row) => {
        const content = (row.content as string | null) ?? '';
        const titleRaw = (row.title as string | null) ?? '';
        const title = displayTitle(titleRaw, content);
        const plain = content
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const assignment = resolveNoteAssignmentLabels(
          row as Parameters<typeof resolveNoteAssignmentLabels>[0],
        );
        return {
          id: row.id as string,
          title,
          excerpt: plain.slice(0, 120) || 'No content yet',
          updatedAt: row.updated_at as string,
          clientName: assignment.clientName,
          projectName: assignment.projectName,
        };
      });

  const { data: taskRows, error: tasksError } = upcomingTasksResult;

  if (!isTableMissingFromApi(tasksError) && tasksError) {
    throw tasksError;
  }

  const needsReplyUnavailable = isTableMissingFromApi(needsReplyResult.error);
  if (!needsReplyUnavailable && needsReplyResult.error) {
    console.error('[dashboard] needs-reply threads', needsReplyResult.error);
  }

  const needsReplyRows = needsReplyUnavailable
    ? []
    : needsReplyResult.error
      ? []
      : (needsReplyResult.data ?? []);

  const lookupClientIds = [
    ...new Set([
      ...(taskRows ?? [])
        .map((t) => t.client_id as string | null)
        .filter((id): id is string => Boolean(id)),
      ...needsReplyRows
        .map((row) => row.client_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const clientNameById = new Map<string, string>();
  if (lookupClientIds.length > 0) {
    const { data: clientRows } = await client
      .from('clients')
      .select('id, display_name, first_name, last_name')
      .in('id', lookupClientIds);
    for (const row of clientRows ?? []) {
      const name =
        (row.display_name as string | null)?.trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        'Client';
      clientNameById.set(row.id as string, name);
    }
  }

  const upcomingTasks: DashboardTaskSummary[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    title: (t.title as string | null) ?? 'Untitled task',
    dueDate: toIsoDateString(t.due_date as string | null | undefined),
    status: (t.status as string | null) ?? 'todo',
    projectName: resolveTaskContextName(t, clientNameById),
  }));

  const needsReplyThreads: DashboardNeedsReplyThread[] = needsReplyRows.map(
    (row) => {
      const participants = Array.isArray(row.participants)
        ? row.participants
        : [];
      const first = participants.find(
        (entry): entry is { name?: string | null; email?: string | null } =>
          Boolean(entry) && typeof entry === 'object',
      );
      const fromLabel =
        first?.name?.trim() || first?.email?.trim() || 'Unknown sender';
      const clientId = row.client_id as string | null;

      return {
        id: row.id as string,
        subject: ((row.subject as string | null)?.trim() ||
          '(no subject)') as string,
        snippet: (row.snippet as string | null)?.trim() || null,
        fromLabel,
        lastMessageAt: (row.last_message_at as string | null) ?? null,
        clientName: clientId ? (clientNameById.get(clientId) ?? null) : null,
      };
    },
  );

  const needsReply: DashboardNeedsReplySummary = {
    threads: needsReplyThreads,
    totalCount: needsReplyUnavailable
      ? 0
      : (needsReplyResult.count ?? needsReplyThreads.length),
  };

  const suggestedEmailTasks: DashboardSuggestedEmailTasksSummary = {
    items: suggestedEmailLoaded.items.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      suggestedDueDate: item.suggestedDueDate,
      threadId: item.threadId,
      threadSubject: item.threadSubject,
      emailSentAt: item.emailSentAt,
    })),
    totalCount: suggestedEmailLoaded.totalCount,
  };

  const accountName = account.name?.trim() || account.slug || accountSlug;

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
    needsReply,
    suggestedEmailTasks,
    recentNotes,
    recentInvoices: [],
    teamMembers: [],
  };
}

function resolveTaskContextName(
  task: {
    client_id?: string | null;
    projects?:
      | { name?: string | null; title?: string | null }
      | Array<{ name?: string | null; title?: string | null }>
      | null;
  },
  clientNameById: Map<string, string>,
): string | null {
  const project = Array.isArray(task.projects)
    ? task.projects[0]
    : task.projects;
  if (project) {
    return project.title?.trim() || project.name?.trim() || 'Project';
  }

  if (task.client_id) {
    return clientNameById.get(task.client_id) ?? 'Client';
  }

  return null;
}
