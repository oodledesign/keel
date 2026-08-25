import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { aggregateTransactionsByMonth } from '~/lib/date-range/analytics-date-range';
import { loadSuggestedEmailActionItems } from '~/lib/email-assistant/suggested-email-tasks.loader';
import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';
import type { DayViewPipeline } from '~/lib/planner/types';

import { toIsoDateString } from '../../../_lib/due-date-ymd';
import {
  type DashboardPipelineDealRow,
  hasRecentPipelineActivity,
  summariseDashboardPipeline,
} from '../dashboard-pipeline-summary';
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
  clientName: string | null;
  clientPictureUrl: string | null;
};

export type DashboardSuggestedEmailTasksSummary = {
  items: DashboardSuggestedEmailTask[];
  totalCount: number;
};

export type DashboardMeetingReviewItem = {
  id: string;
  suggestedTitle: string;
  meetingTitle: string;
  suggestedDueDate: string | null;
  clientName: string | null;
  clientPictureUrl: string | null;
};

export type DashboardMeetingReviewSummary = {
  items: DashboardMeetingReviewItem[];
  totalCount: number;
};

export type DashboardSupportTicketSummary = {
  id: string;
  ticketNumber: number;
  title: string;
  priority: string;
  clientName: string | null;
  lastActivityAt: string | null;
};

export type DashboardSupportTicketsSummary = {
  tickets: DashboardSupportTicketSummary[];
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
  upcomingTasksTotalCount: number;
  needsReply: DashboardNeedsReplySummary;
  suggestedEmailTasks: DashboardSuggestedEmailTasksSummary;
  meetingTaskReview: DashboardMeetingReviewSummary;
  openSupportTickets: DashboardSupportTicketsSummary;
  recentNotes: DashboardNoteSummary[];
  recentInvoices: DashboardInvoiceSummary[];
  teamMembers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;
  pipeline: DayViewPipeline | null;
  recommendationSignals: {
    accountRole: string | null;
    seatKind: string | null;
    hasRecentPipelineActivity: boolean;
    openSupportTicketCount: number;
    hasRecentInvoiceActivity: boolean;
  };
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

  const invoiceActivityCutoff = new Date();
  invoiceActivityCutoff.setDate(invoiceActivityCutoff.getDate() - 14);
  const invoiceActivityCutoffIso = invoiceActivityCutoff.toISOString();

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
    upcomingTasksCountResult,
    meetingReviewResult,
    suggestedEmailLoaded,
    openSupportTicketsResult,
    pipelineDealsResult,
    activeJobsListResult,
    projectStatusCountsResult,
    recentInvoicesResult,
    recentInvoiceActivityResult,
    teamMembersResult,
    membershipResult,
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
      .is('archived_at', null)
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
    client
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('parent_task_id', null)
      .not('status', 'in', '("done","cancelled")'),
    client
      .from('meeting_action_items')
      .select(
        `
        id,
        suggested_title,
        suggested_due_date,
        meeting_transcripts:meeting_transcript_id (
          title,
          client_id,
          clients:client_id (
            id,
            display_name,
            company_name,
            first_name,
            last_name,
            picture_url
          )
        )
      `,
        { count: 'exact' },
      )
      .eq('account_id', accountId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(5),
    userId
      ? loadSuggestedEmailActionItems(client, userId, {
          accountId,
          limit: 5,
        })
      : Promise.resolve({ items: [], totalCount: 0 }),
    client
      .from('support_tickets')
      .select(
        'id, ticket_number, title, priority, last_activity_at, client_org_id, client_orgs(name)',
        { count: 'exact' },
      )
      .or(`business_id.eq.${accountId},account_id.eq.${accountId}`)
      .eq('status', 'open')
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .limit(6),
    client
      .from('pipeline_deals')
      .select(
        'id, stage, value, contact_name, company_name, next_action, next_action_date, updated_at',
      )
      .eq('account_id', accountId)
      .not('stage', 'in', '("won","lost")'),
    client
      .from('projects')
      .select('id, title, name, status, priority, due_date, client_id')
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .in('status', ['pending', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(8),
    client
      .from('projects')
      .select('status')
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .in('status', ['pending', 'in_progress', 'completed']),
    client
      .from('invoices')
      .select(
        'id, invoice_number, total_pence, due_at, status, clients(display_name)',
      )
      .eq('account_id', accountId)
      .is('archived_at', null)
      .not('status', 'in', '("paid","void","cancelled")')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(5),
    client
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('archived_at', null)
      .gte('updated_at', invoiceActivityCutoffIso),
    client.rpc('get_account_members', { account_slug: accountSlug }),
    userId
      ? client
          .from('accounts_memberships')
          .select('account_role, seat_kind')
          .eq('account_id', accountId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
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
        .in('assistant_category', ['reply_now', 'reply_later'])
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(5)
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

  if (!isTableMissingFromApi(projectStatusCountsResult.error)) {
    for (const row of projectStatusCountsResult.data ?? []) {
      const status = (row.status as string | null) ?? '';
      if (status === 'completed') statusSummary.completed += 1;
      else if (status === 'in_progress') statusSummary.inProgress += 1;
      else if (status === 'pending') statusSummary.pending += 1;
    }
  }

  const activeJobsUnavailable =
    Boolean(activeJobsListResult.error) &&
    !isTableMissingFromApi(activeJobsListResult.error);

  if (activeJobsUnavailable) {
    console.error(
      '[dashboard] active projects list',
      activeJobsListResult.error,
    );
  }

  const projectRows =
    activeJobsUnavailable || isTableMissingFromApi(activeJobsListResult.error)
      ? []
      : (activeJobsListResult.data ?? []);

  const projectClientIds = [
    ...new Set(
      projectRows
        .map((row) => row.client_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const projectClientNameById = new Map<string, string>();
  if (projectClientIds.length > 0) {
    const { data: projectClientRows, error: projectClientsError } = await client
      .from('clients')
      .select('id, display_name, first_name, last_name')
      .in('id', projectClientIds);

    if (projectClientsError) {
      console.error('[dashboard] project client names', projectClientsError);
    } else {
      for (const row of projectClientRows ?? []) {
        const name =
          (row.display_name as string | null)?.trim() ||
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          'Client';
        projectClientNameById.set(row.id as string, name);
      }
    }
  }

  const activeJobsList: DashboardJobSummary[] = projectRows.map((row) => {
    const clientId = row.client_id as string | null;
    return {
      id: row.id as string,
      title: ((row.title as string | null)?.trim() ||
        (row.name as string | null)?.trim() ||
        'Untitled project') as string,
      clientName: clientId
        ? (projectClientNameById.get(clientId) ?? null)
        : null,
      status: (row.status as string | null) ?? 'pending',
      priority: (row.priority as string | null) ?? 'medium',
      dueDate: toIsoDateString(row.due_date as string | null | undefined),
    };
  });

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

  const upcomingTasksTotalCount = isTableMissingFromApi(
    upcomingTasksCountResult.error,
  )
    ? upcomingTasks.length
    : (upcomingTasksCountResult.count ?? upcomingTasks.length);

  const meetingReviewUnavailable = isTableMissingFromApi(
    meetingReviewResult.error,
  );
  if (!meetingReviewUnavailable && meetingReviewResult.error) {
    console.error('[dashboard] meeting task review', meetingReviewResult.error);
  }

  const meetingReviewRows = meetingReviewUnavailable
    ? []
    : meetingReviewResult.error
      ? []
      : (meetingReviewResult.data ?? []);

  const meetingTaskReview: DashboardMeetingReviewSummary = {
    items: meetingReviewRows.map((row) => {
      const transcript = Array.isArray(row.meeting_transcripts)
        ? row.meeting_transcripts[0]
        : row.meeting_transcripts;
      const clientRow = Array.isArray(transcript?.clients)
        ? transcript?.clients[0]
        : transcript?.clients;
      const clientName =
        (clientRow?.display_name as string | null | undefined)?.trim() ||
        (clientRow?.company_name as string | null | undefined)?.trim() ||
        [clientRow?.first_name, clientRow?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        null;

      return {
        id: row.id as string,
        suggestedTitle: ((row.suggested_title as string | null)?.trim() ||
          'Untitled task') as string,
        meetingTitle: (transcript?.title as string | null)?.trim() || 'Meeting',
        suggestedDueDate: toIsoDateString(
          row.suggested_due_date as string | null | undefined,
        ),
        clientName,
        clientPictureUrl:
          (clientRow?.picture_url as string | null | undefined)?.trim() || null,
      };
    }),
    totalCount: meetingReviewUnavailable
      ? 0
      : (meetingReviewResult.count ?? meetingReviewRows.length),
  };

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
      clientName: item.clientName,
      clientPictureUrl: item.clientPictureUrl,
    })),
    totalCount: suggestedEmailLoaded.totalCount,
  };

  const supportTicketsUnavailable = isTableMissingFromApi(
    openSupportTicketsResult.error,
  );
  if (!supportTicketsUnavailable && openSupportTicketsResult.error) {
    console.error(
      '[dashboard] open support tickets',
      openSupportTicketsResult.error,
    );
  }

  const openSupportTicketRows = supportTicketsUnavailable
    ? []
    : openSupportTicketsResult.error
      ? []
      : (openSupportTicketsResult.data ?? []);

  const openSupportTickets: DashboardSupportTicketsSummary = {
    tickets: openSupportTicketRows.map((row) => {
      const org = Array.isArray(row.client_orgs)
        ? row.client_orgs[0]
        : row.client_orgs;
      return {
        id: row.id as string,
        ticketNumber: (row.ticket_number as number | null) ?? 0,
        title: ((row.title as string | null)?.trim() ||
          'Untitled ticket') as string,
        priority: (row.priority as string | null) ?? 'medium',
        clientName: (org?.name as string | null)?.trim() || null,
        lastActivityAt: (row.last_activity_at as string | null) ?? null,
      };
    }),
    totalCount: supportTicketsUnavailable
      ? 0
      : (openSupportTicketsResult.count ?? openSupportTicketRows.length),
  };

  const accountName = account.name?.trim() || account.slug || accountSlug;

  const pipelineUnavailable = isTableMissingFromApi(pipelineDealsResult.error);
  if (!pipelineUnavailable && pipelineDealsResult.error) {
    console.error('[dashboard] pipeline deals', pipelineDealsResult.error);
  }

  const pipelineDealRows = (
    pipelineUnavailable || pipelineDealsResult.error
      ? []
      : (pipelineDealsResult.data ?? [])
  ) as DashboardPipelineDealRow[];

  const pipelineHref = pathsConfig.app.accountPipeline.replace(
    '[account]',
    account.slug ?? accountSlug,
  );
  const pipeline = summariseDashboardPipeline(pipelineDealRows, pipelineHref);

  const invoicesListUnavailable = isTableMissingFromApi(
    recentInvoicesResult.error,
  );
  const recentInvoices: DashboardInvoiceSummary[] =
    invoicesListUnavailable || recentInvoicesResult.error
      ? []
      : (recentInvoicesResult.data ?? []).map((row) => {
          const clientEmbed = Array.isArray(row.clients)
            ? row.clients[0]
            : row.clients;
          return {
            id: row.id as string,
            invoiceNumber: ((row.invoice_number as string | null)?.trim() ||
              'Invoice') as string,
            clientName:
              (clientEmbed?.display_name as string | null)?.trim() || null,
            totalPence: (row.total_pence as number | null) ?? 0,
            dueAt: (row.due_at as string | null) ?? null,
            status: (row.status as string | null) ?? 'draft',
          };
        });

  const teamMembers: DashboardPageData['teamMembers'] = teamMembersResult.error
    ? []
    : (
        (teamMembersResult.data ?? []) as Array<{
          user_id?: string;
          name?: string | null;
          email?: string | null;
          role?: string | null;
          account_role?: string | null;
        }>
      )
        .map((row) => ({
          userId: row.user_id ?? '',
          name: row.name ?? null,
          email: row.email ?? null,
          role: row.role ?? row.account_role ?? null,
        }))
        .filter((m) => Boolean(m.userId));

  const accountRole =
    (membershipResult.data as { account_role?: string | null } | null)
      ?.account_role ??
    (workspace.account as { role?: string | null }).role ??
    null;
  const seatKind =
    (membershipResult.data as { seat_kind?: string | null } | null)
      ?.seat_kind ?? null;

  const hasRecentInvoiceActivity =
    !isTableMissingFromApi(recentInvoiceActivityResult.error) &&
    (recentInvoiceActivityResult.count ?? 0) > 0;

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
    upcomingTasksTotalCount,
    needsReply,
    suggestedEmailTasks,
    meetingTaskReview,
    openSupportTickets,
    recentNotes,
    recentInvoices,
    teamMembers,
    pipeline,
    recommendationSignals: {
      accountRole,
      seatKind,
      hasRecentPipelineActivity: hasRecentPipelineActivity(pipelineDealRows),
      openSupportTicketCount: openSupportTickets.totalCount,
      hasRecentInvoiceActivity,
    },
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
