import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { parseDueDateParts, toIsoDateString } from '../../../_lib/due-date-ymd';
import { workspaceColorForSpaceType } from '../workspace-accent';

/** Cap task payloads for faster SSR and hydration. */
export const TASK_LIST_LIMIT = 300;
/**
 * Completed/done rows are loaded separately so they don't crowd out later active work.
 * Ordered by recently updated so a just-completed task always lands in this slice.
 */
export const COMPLETED_TASK_LIST_LIMIT = 500;

const ACTIVE_TASK_STATUSES = ['todo', 'in_progress', 'client_review'] as const;

/** Include notes so list/export views can show descriptions without a second fetch. */
const TASK_LIST_SELECT =
  'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, user_id, assignee_contact_id, notes, calendar_schedule_status, recurring_series_id, note_refs, source';

const TASK_SELECT =
  'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, user_id, assignee_contact_id, notes, calendar_schedule_status, recurring_series_id, note_refs, source';

/** Same as TASK_SELECT; kept for call sites that try series first. */
const TASK_SELECT_WITH_SERIES = TASK_SELECT;

export type TaskSourceKind = 'manual' | 'meeting' | 'email';

export type TaskSourceContext = {
  title: string | null;
  excerpt: string | null;
  href: string | null;
};

type TaskQueryRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  area_id?: string | null;
  account_id?: string | null;
  parent_task_id?: string | null;
  user_id?: string | null;
  assignee_contact_id?: string | null;
  notes?: string | null;
  calendar_schedule_status?: string | null;
  recurring_series_id?: string | null;
  note_refs?: unknown;
  source?: string | null;
};

type BusinessEnrichment = {
  colour?: string | null;
  account_id?: string | null;
};

type ProjectEnrichment = {
  id: string;
  name?: string | null;
  title?: string | null;
  project_type?: string | null;
  account_id?: string | null;
  business_id?: string | null;
  client_id?: string | null;
  businesses?: BusinessEnrichment | null;
};

type ClientEnrichment = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  account_id?: string | null;
  picture_url?: string | null;
};

type AccountWorkspaceRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  space_type?: string | null;
};

type AreaEnrichment = {
  id: string;
  name?: string | null;
  colour?: string | null;
};

type ContactAssigneeEnrichment = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type MemberAssigneeEnrichment = {
  id: string;
  name?: string | null;
  email?: string | null;
};

function isWorkTaskRow(row: {
  project_id?: string | null;
  client_id?: string | null;
  account_id?: string | null;
}): boolean {
  return Boolean(row.project_id || row.client_id || row.account_id);
}

function deliveryProjectDisplayName(project: ProjectEnrichment): string | null {
  if (project.project_type === 'campaign') {
    return project.name?.trim() || null;
  }
  return project.title?.trim() || project.name?.trim() || null;
}

export type TasksPageTask = {
  id: string;
  title: string;
  projectName: string | null;
  areaLabel: string | null;
  context: 'work' | 'life';
  status: 'pending' | 'in_progress' | 'client_review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDateLabel: string;
  dueDate: string | null; // ISO date for edit form
  accentColor: string | null;
  /** Direct `tasks.client_id`, or the linked project's client when the task is only on a project. */
  clientId: string | null;
  projectId: string | null;
  areaId: string | null;
  clientName: string | null;
  clientPictureUrl: string | null;
  /** Resolved assignee label (contact preferred over team member). */
  assigneeName: string | null;
  /** Team member assignee (`tasks.user_id`). */
  assigneeUserId: string | null;
  /** External CRM contact assignee when set. */
  assigneeContactId: string | null;
  /** Team account (workspace) for work tasks — from linked project or client. */
  workspaceName: string | null;
  workspaceSlug: string | null;
  /** Accent for cross-workspace list chips (business colour or space-type default). */
  workspaceColor: string | null;
  /** Resolved team account id for work tasks (notes attach, etc.). */
  accountId: string | null;
  parentTaskId: string | null;
  notes: string | null;
  noteRefs: Array<{ id: string; title: string }>;
  calendarScheduleStatus: 'scheduled' | 'failed' | null;
  /** Present when this task was spawned from a recurring series. */
  recurringSeriesId: string | null;
  /** How the task was created — manual, meeting extract, or email extract. */
  source: TaskSourceKind;
  /** Populated on edit load for meeting/email sources. */
  sourceContext: TaskSourceContext | null;
  /** Populated for root tasks only (see `nestTaskTree`). */
  subtasks?: TasksPageTask[];
};

function normalizeTaskSource(value: string | null | undefined): TaskSourceKind {
  if (value === 'meeting' || value === 'email') {
    return value;
  }
  return 'manual';
}

function workspaceFromAccountId(
  accountId: string | null | undefined,
  accountsById: Map<string, AccountWorkspaceRow>,
): { name: string | null; slug: string | null } {
  if (!accountId) {
    return { name: null, slug: null };
  }
  const row = accountsById.get(accountId);
  if (!row) {
    return { name: null, slug: null };
  }
  return {
    name: row.name?.trim() || null,
    slug: row.slug?.trim() || null,
  };
}

function mapTaskStatus(
  status: string | null | undefined,
): 'pending' | 'in_progress' | 'client_review' | 'completed' {
  switch ((status ?? '').toLowerCase()) {
    case 'todo':
    case 'pending':
    case 'not_started':
    case 'open':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'client_review':
    case 'review':
    case 'in_review':
    case 'awaiting_client':
      return 'client_review';
    case 'done':
    case 'completed':
    case 'complete':
    case 'cancelled':
      return 'completed';
    default:
      return 'pending';
  }
}

function formatDueDateLabel(due: string | null): string {
  const parts = parseDueDateParts(due);
  if (!parts) return '';
  const date = new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function clientDisplayName(client: ClientEnrichment): string | null {
  const displayName = client.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [client.first_name, client.last_name]
    .filter((value): value is string => Boolean(value && String(value).trim()))
    .map((value) => String(value).trim())
    .join(' ');

  return fullName || null;
}

function applyClientContext(
  clientId: string | null | undefined,
  maps: {
    clients: Map<string, ClientEnrichment>;
    accountsById: Map<string, AccountWorkspaceRow>;
  },
  current: {
    clientName: string | null;
    resolvedAccountId: string | null;
    workspaceName: string | null;
    workspaceSlug: string | null;
  },
) {
  if (!clientId) {
    return current;
  }

  const client = maps.clients.get(clientId);
  if (!client) {
    return current;
  }

  const next = { ...current };
  next.clientName = next.clientName ?? clientDisplayName(client);

  if (!next.resolvedAccountId) {
    next.resolvedAccountId = client.account_id ?? null;
  }

  if (!next.workspaceName) {
    const workspace = workspaceFromAccountId(
      client.account_id,
      maps.accountsById,
    );
    next.workspaceName = workspace.name;
    next.workspaceSlug = workspace.slug;
  }

  return next;
}

function normalizeTaskNoteRefs(
  value: unknown,
): Array<{ id: string; title: string }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ id: string; title: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const title = (item as { title?: unknown }).title;
    if (typeof id !== 'string' || !id) continue;
    out.push({
      id,
      title:
        typeof title === 'string' && title.trim()
          ? title.trim()
          : 'Untitled note',
    });
  }
  return out;
}

function contactAssigneeDisplayName(
  contact: ContactAssigneeEnrichment,
): string | null {
  const fullName = contact.full_name?.trim();
  if (fullName) return fullName;
  const composed = [contact.first_name, contact.last_name]
    .filter((value): value is string => Boolean(value && String(value).trim()))
    .map((value) => String(value).trim())
    .join(' ');
  return composed || contact.email?.trim() || null;
}

function memberAssigneeDisplayName(
  member: MemberAssigneeEnrichment,
): string | null {
  return member.name?.trim() || member.email?.trim() || null;
}

function resolveAssigneeName(
  row: TaskQueryRow,
  maps: {
    contactsById: Map<string, ContactAssigneeEnrichment>;
    membersById: Map<string, MemberAssigneeEnrichment>;
  },
): string | null {
  // Contact assignee takes precedence (user_id stays the internal owner).
  if (row.assignee_contact_id) {
    const contact = maps.contactsById.get(row.assignee_contact_id);
    if (contact) {
      return contactAssigneeDisplayName(contact);
    }
  }
  if (row.user_id) {
    const member = maps.membersById.get(row.user_id);
    if (member) {
      return memberAssigneeDisplayName(member);
    }
  }
  return null;
}

function taskRowToPageTask(
  row: TaskQueryRow,
  maps: {
    projects: Map<string, ProjectEnrichment>;
    clients: Map<string, ClientEnrichment>;
    areas: Map<string, AreaEnrichment>;
    accountsById: Map<string, AccountWorkspaceRow>;
    contactsById: Map<string, ContactAssigneeEnrichment>;
    membersById: Map<string, MemberAssigneeEnrichment>;
  },
  contextOverride?: 'work' | 'life',
  workspaceFallback?: { name: string; slug: string | null },
): TasksPageTask {
  const dueDateRaw = row.due_date ?? null;
  let projectName: string | null = null;
  let areaLabel: string | null = null;
  let accentColor: string | null = null;
  let clientName: string | null = null;
  let workspaceName: string | null = null;
  let workspaceSlug: string | null = null;
  let workspaceColor: string | null = null;
  let resolvedAccountId: string | null = null;

  if (row.project_id) {
    const p = maps.projects.get(row.project_id);
    projectName =
      p && p.project_type !== 'campaign'
        ? deliveryProjectDisplayName(p)
        : (p?.name ?? null);
    const biz = p?.businesses;
    accentColor = biz?.colour ?? null;
    resolvedAccountId = p?.account_id ?? biz?.account_id ?? null;
    const ws = workspaceFromAccountId(resolvedAccountId, maps.accountsById);
    workspaceName = ws.name;
    workspaceSlug = ws.slug;
  }
  if (row.client_id) {
    const resolved = applyClientContext(row.client_id, maps, {
      clientName,
      resolvedAccountId,
      workspaceName,
      workspaceSlug,
    });
    clientName = resolved.clientName;
    resolvedAccountId = resolved.resolvedAccountId;
    workspaceName = resolved.workspaceName;
    workspaceSlug = resolved.workspaceSlug;
  }

  if (!clientName && row.project_id) {
    const projectClientId = maps.projects.get(row.project_id)?.client_id;
    const resolved = applyClientContext(projectClientId, maps, {
      clientName,
      resolvedAccountId,
      workspaceName,
      workspaceSlug,
    });
    clientName = resolved.clientName;
    resolvedAccountId = resolved.resolvedAccountId;
    workspaceName = resolved.workspaceName;
    workspaceSlug = resolved.workspaceSlug;
  }

  if (!resolvedAccountId && row.account_id) {
    resolvedAccountId = row.account_id;
    const ws = workspaceFromAccountId(row.account_id, maps.accountsById);
    workspaceName = ws.name;
    workspaceSlug = ws.slug;
  }

  if (resolvedAccountId) {
    const accountRow = maps.accountsById.get(resolvedAccountId);
    workspaceColor =
      accentColor ??
      workspaceColorForSpaceType(accountRow?.space_type ?? 'work');
  } else if (!isWorkTaskRow(row)) {
    workspaceColor = '#7C3AED';
  }
  if (row.area_id) {
    const a = maps.areas.get(row.area_id);
    if (!row.project_id) {
      areaLabel = a?.name ?? null;
      accentColor = accentColor ?? a?.colour ?? null;
    }
  }

  const context: 'work' | 'life' =
    contextOverride ?? (isWorkTaskRow(row) ? 'work' : 'life');

  if (!workspaceName && workspaceFallback && context === 'work') {
    workspaceName = workspaceFallback.name;
    workspaceSlug = workspaceFallback.slug;
  }

  let clientPictureUrl: string | null = null;
  const resolvedClientId =
    row.client_id ?? maps.projects.get(row.project_id ?? '')?.client_id ?? null;
  if (resolvedClientId) {
    const client = maps.clients.get(resolvedClientId);
    if (client?.picture_url?.trim()) {
      clientPictureUrl =
        toSupabasePublicStorageUrl(client.picture_url.trim()) || null;
    }
  }

  return {
    id: row.id,
    title: (row.title as string) ?? 'Untitled',
    projectName,
    areaLabel,
    context,
    status: mapTaskStatus(row.status),
    priority: (row.priority as TasksPageTask['priority']) ?? 'medium',
    dueDateLabel: formatDueDateLabel(dueDateRaw),
    dueDate: toIsoDateString(dueDateRaw),
    accentColor,
    clientId: resolvedClientId,
    projectId: row.project_id ?? null,
    areaId: row.area_id ?? null,
    clientName,
    clientPictureUrl,
    assigneeName: resolveAssigneeName(row, maps),
    assigneeUserId: row.user_id ?? null,
    assigneeContactId: row.assignee_contact_id ?? null,
    workspaceName,
    workspaceSlug,
    workspaceColor,
    accountId: resolvedAccountId,
    parentTaskId: row.parent_task_id ?? null,
    notes: row.notes?.trim() ? row.notes : null,
    noteRefs: normalizeTaskNoteRefs(row.note_refs),
    calendarScheduleStatus:
      row.calendar_schedule_status === 'scheduled' ||
      row.calendar_schedule_status === 'failed'
        ? row.calendar_schedule_status
        : null,
    recurringSeriesId: row.recurring_series_id ?? null,
    source: normalizeTaskSource(row.source),
    sourceContext: null,
  };
}

function nestTaskTree(flat: TasksPageTask[]): TasksPageTask[] {
  const byParent = new Map<string, TasksPageTask[]>();
  for (const t of flat) {
    if (t.parentTaskId) {
      const list = byParent.get(t.parentTaskId) ?? [];
      list.push(t);
      byParent.set(t.parentTaskId, list);
    }
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const da = a.dueDate ?? '';
      const db = b.dueDate ?? '';
      if (da !== db) return da.localeCompare(db);
      return a.title.localeCompare(b.title);
    });
  }
  const loadedIds = new Set(flat.map((t) => t.id));
  return flat
    .filter((t) => !t.parentTaskId || !loadedIds.has(t.parentTaskId))
    .map((t) => ({
      ...t,
      subtasks: byParent.get(t.id) ?? [],
    }));
}

async function enrichTaskRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  rows: TaskQueryRow[],
  contextOverride?: 'work' | 'life',
  /** Use for project/client names when session RLS hides rows (e.g. team workspace). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichmentClient?: SupabaseClient<any>,
  nest = true,
  workspaceFallback?: { name: string; slug: string | null },
): Promise<TasksPageTask[]> {
  const rowDb = enrichmentClient ?? client;

  const projectIds = [
    ...new Set(rows.map((r) => r.project_id).filter(Boolean)),
  ] as string[];
  const areaIds = [
    ...new Set(rows.map((r) => r.area_id).filter(Boolean)),
  ] as string[];

  const [projectsResult, areasResult] = await Promise.all([
    projectIds.length > 0
      ? rowDb
          .from('projects')
          .select(
            'id, name, title, project_type, account_id, business_id, client_id, businesses(colour, account_id)',
          )
          .in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectEnrichment[] }),
    areaIds.length > 0
      ? client.from('areas').select('id, name, colour').in('id', areaIds)
      : Promise.resolve({ data: [] as AreaEnrichment[] }),
  ]);

  const projects = new Map<string, ProjectEnrichment>();
  for (const p of (projectsResult.data ?? []) as ProjectEnrichment[]) {
    projects.set(p.id, p);
  }
  const areas = new Map<string, AreaEnrichment>();
  for (const a of (areasResult.data ?? []) as AreaEnrichment[]) {
    areas.set(a.id, a);
  }

  const clientIds = [
    ...new Set(
      [
        ...rows.map((row) => row.client_id),
        ...[...projects.values()].map((project) => project.client_id),
      ].filter(Boolean),
    ),
  ] as string[];

  const accountIdSet = new Set<string>();
  for (const p of projects.values()) {
    if (p.account_id) {
      accountIdSet.add(p.account_id);
    }
    const bizAccountId = p.businesses?.account_id;
    if (bizAccountId) {
      accountIdSet.add(bizAccountId);
    }
  }
  for (const row of rows) {
    if (row.account_id) {
      accountIdSet.add(row.account_id);
    }
  }
  const uniqueAccountIds = [...accountIdSet];

  const [clientsResult, accountsResult] = await Promise.all([
    clientIds.length > 0
      ? rowDb
          .from('clients')
          .select(
            'id, display_name, first_name, last_name, account_id, picture_url',
          )
          .in('id', clientIds)
      : Promise.resolve({ data: [] as ClientEnrichment[] }),
    uniqueAccountIds.length > 0
      ? rowDb
          .from('accounts')
          .select('id, name, slug, space_type')
          .in('id', uniqueAccountIds)
      : Promise.resolve({ data: [] as AccountWorkspaceRow[] }),
  ]);

  const clients = new Map<string, ClientEnrichment>();
  for (const c of (clientsResult.data ?? []) as ClientEnrichment[]) {
    clients.set(c.id, c);
  }

  const accountsById = new Map<string, AccountWorkspaceRow>();
  for (const r of (accountsResult.data ?? []) as AccountWorkspaceRow[]) {
    if (r.id) {
      accountsById.set(r.id, r);
    }
  }

  const contactIds = [
    ...new Set(
      rows
        .map((row) => row.assignee_contact_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const memberIds = [
    ...new Set(
      rows
        .filter((row) => !row.assignee_contact_id)
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [contactsResult, membersResult] = await Promise.all([
    contactIds.length > 0
      ? rowDb
          .from('contacts')
          .select('id, full_name, first_name, last_name, email')
          .in('id', contactIds)
      : Promise.resolve({ data: [] as ContactAssigneeEnrichment[] }),
    memberIds.length > 0
      ? rowDb.from('accounts').select('id, name, email').in('id', memberIds)
      : Promise.resolve({ data: [] as MemberAssigneeEnrichment[] }),
  ]);

  const contactsById = new Map<string, ContactAssigneeEnrichment>();
  for (const contact of (contactsResult.data ??
    []) as ContactAssigneeEnrichment[]) {
    contactsById.set(contact.id, contact);
  }

  const membersById = new Map<string, MemberAssigneeEnrichment>();
  for (const member of (membersResult.data ??
    []) as MemberAssigneeEnrichment[]) {
    membersById.set(member.id, member);
  }

  const maps = {
    projects,
    clients,
    areas,
    accountsById,
    contactsById,
    membersById,
  };

  const flat = rows.map((row) =>
    taskRowToPageTask(row, maps, contextOverride, workspaceFallback),
  );
  return nest ? nestTaskTree(flat) : flat;
}

async function loadTaskSourceContext(
  // PostgREST client — keep loose to match enrichTaskRows / list loaders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  task: TasksPageTask,
): Promise<{
  source: TaskSourceKind;
  sourceContext: TaskSourceContext | null;
}> {
  let source = task.source;

  if (source === 'manual') {
    const [{ data: meetingLink }, { data: emailLink }] = await Promise.all([
      client
        .from('meeting_action_items')
        .select('id')
        .eq('planner_task_id', task.id)
        .limit(1)
        .maybeSingle(),
      client
        .from('email_action_items')
        .select('id')
        .eq('task_id', task.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (meetingLink) {
      source = 'meeting';
    } else if (emailLink) {
      source = 'email';
    }
  }

  if (source === 'meeting') {
    const { data } = await client
      .from('meeting_action_items')
      .select(
        `
        source_excerpt,
        meeting_transcript_id,
        meeting_transcripts:meeting_transcript_id (
          id,
          title,
          account_id
        )
      `,
      )
      .eq('planner_task_id', task.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { source, sourceContext: null };
    }

    const transcriptRaw = data.meeting_transcripts as
      | { id: string; title: string | null; account_id: string }
      | { id: string; title: string | null; account_id: string }[]
      | null;
    const transcript = Array.isArray(transcriptRaw)
      ? (transcriptRaw[0] ?? null)
      : transcriptRaw;

    const href =
      task.workspaceSlug && transcript?.id
        ? `/app/${task.workspaceSlug}/meetings/${transcript.id}`
        : null;

    return {
      source,
      sourceContext: {
        title: transcript?.title?.trim() || null,
        excerpt: data.source_excerpt?.trim() || null,
        href,
      },
    };
  }

  if (source === 'email') {
    const { data } = await client
      .from('email_action_items')
      .select(
        `
        source_excerpt,
        detail,
        thread_id,
        email_threads:thread_id (
          id,
          subject,
          snippet
        )
      `,
      )
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { source, sourceContext: null };
    }

    const threadRaw = data.email_threads as
      | { id: string; subject: string | null; snippet: string | null }
      | { id: string; subject: string | null; snippet: string | null }[]
      | null;
    const thread = Array.isArray(threadRaw)
      ? (threadRaw[0] ?? null)
      : threadRaw;

    const href = task.workspaceSlug
      ? `/app/${task.workspaceSlug}/email`
      : '/app/email';

    return {
      source,
      sourceContext: {
        title: thread?.subject?.trim() || null,
        excerpt:
          data.source_excerpt?.trim() ||
          data.detail?.trim() ||
          thread?.snippet?.trim() ||
          null,
        href,
      },
    };
  }

  return { source: 'manual', sourceContext: null };
}

/** Load a single task for the edit dialog (dashboard quick-open, etc.). */
export async function loadTaskById(
  taskId: string,
  options?: { workspaceAccountId?: string },
): Promise<TasksPageTask | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  let data: TaskQueryRow | null = null;

  const withSeries = await client
    .from('tasks')
    .select(TASK_SELECT_WITH_SERIES)
    .eq('id', taskId)
    .maybeSingle();

  if (
    withSeries.error?.message?.includes('recurring_series_id') ||
    withSeries.error?.message?.includes('source') ||
    withSeries.error?.code === '42703'
  ) {
    const fallbackSelect = withSeries.error?.message?.includes('source')
      ? TASK_SELECT.replace(', source', '')
      : TASK_SELECT;
    const fallback = await client
      .from('tasks')
      .select(fallbackSelect)
      .eq('id', taskId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return null;
    }
    data = fallback.data as unknown as TaskQueryRow;
  } else if (withSeries.error || !withSeries.data) {
    return null;
  } else {
    data = withSeries.data as unknown as TaskQueryRow;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enrichmentClient: SupabaseClient<any> | undefined;

  if (options?.workspaceAccountId) {
    try {
      enrichmentClient = await getDbForWorkspaceTaskAssignmentOptions(
        client,
        user.id,
        options.workspaceAccountId,
      );
    } catch {
      return null;
    }
  }

  const tasks = await enrichTaskRows(
    client,
    [data],
    options?.workspaceAccountId ? 'work' : undefined,
    enrichmentClient,
    false,
  );

  let task = tasks[0] ?? null;

  if (!task) {
    return null;
  }

  const sourceMeta = await loadTaskSourceContext(client, task);
  task = {
    ...task,
    source: sourceMeta.source,
    sourceContext: sourceMeta.sourceContext,
  };

  if (task.parentTaskId) {
    return task;
  }

  const { data: childRows, error: childError } = await client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', user.id)
    .eq('parent_task_id', taskId)
    .order('due_date', { ascending: true, nullsFirst: false });

  let resolvedChildren = childRows as TaskQueryRow[] | null;

  if (
    childError &&
    (childError.message?.includes('source') || childError.code === '42703')
  ) {
    const fallback = await client
      .from('tasks')
      .select(
        'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, user_id, assignee_contact_id, notes, calendar_schedule_status, recurring_series_id, note_refs',
      )
      .eq('user_id', user.id)
      .eq('parent_task_id', taskId)
      .order('due_date', { ascending: true, nullsFirst: false });
    resolvedChildren = (fallback.data ?? null) as TaskQueryRow[] | null;
  } else if (childError) {
    return { ...task, subtasks: [] };
  }

  if (!resolvedChildren?.length) {
    return { ...task, subtasks: [] };
  }

  const subtasks = await enrichTaskRows(
    client,
    resolvedChildren,
    options?.workspaceAccountId ? 'work' : undefined,
    enrichmentClient,
    false,
  );

  subtasks.sort((a, b) => {
    const da = a.dueDate ?? '';
    const db = b.dueDate ?? '';
    if (da !== db) return da.localeCompare(db);
    return a.title.localeCompare(b.title);
  });

  return { ...task, subtasks };
}

/**
 * Prefer active tasks up to TASK_LIST_LIMIT, then a slice of completed ones.
 * Ordering by due_date alone previously hid later-due active work behind done rows.
 */
async function fetchActiveThenCompletedTaskRows(
  client: SupabaseClient,
  // PostgREST filter builder — keep loose to avoid coupling to generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters: (q: any) => any,
): Promise<TaskQueryRow[]> {
  const run = async (selectCols: string) => {
    const activePromise = applyFilters(client.from('tasks').select(selectCols))
      .in('status', [...ACTIVE_TASK_STATUSES])
      .order('due_date', { ascending: true, nullsLast: true })
      .limit(TASK_LIST_LIMIT);
    const completedPromise = applyFilters(
      client.from('tasks').select(selectCols),
    )
      .eq('status', 'done')
      .order('updated_at', { ascending: false, nullsLast: true })
      .order('due_date', { ascending: false, nullsLast: true })
      .limit(COMPLETED_TASK_LIST_LIMIT);
    return Promise.all([activePromise, completedPromise]);
  };

  let [
    { data: active, error: activeError },
    { data: completed, error: completedError },
  ] = await run(TASK_LIST_SELECT);

  if (
    activeError &&
    /note_refs|recurring_series_id|source|assignee_contact_id/i.test(
      `${activeError.message ?? ''}`,
    )
  ) {
    const fallbackSelect =
      'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, user_id, notes, calendar_schedule_status';
    [
      { data: active, error: activeError },
      { data: completed, error: completedError },
    ] = await run(fallbackSelect);
  }

  if (activeError) {
    throw new Error(activeError.message);
  }
  if (completedError) {
    console.error(
      '[tasks.loader] completed slice error:',
      completedError.message,
    );
  }

  return [
    ...((active ?? []) as TaskQueryRow[]),
    ...((completed ?? []) as TaskQueryRow[]),
  ];
}

export const loadTasksForUser = cache(async (): Promise<TasksPageTask[]> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  try {
    const rows = await fetchActiveThenCompletedTaskRows(client, (q) =>
      q.eq('user_id', user.id),
    );
    return enrichTaskRows(client, rows);
  } catch (err) {
    console.error(
      '[tasks.loader] loadTasksForUser error:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
});

/** Tasks for a specific client (current user's tasks linked to this client). */
export const loadTasksForClient = cache(
  async (clientId: string): Promise<TasksPageTask[]> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        clientId,
      )
    ) {
      return [];
    }

    try {
      const { data: projectRows } = await client
        .from('projects')
        .select('id')
        .eq('client_id', clientId);
      const projectIds = (projectRows ?? [])
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const rows = await fetchActiveThenCompletedTaskRows(client, (q) => {
        const scoped = q.eq('user_id', user.id);
        if (projectIds.length === 0) {
          return scoped.eq('client_id', clientId);
        }
        return scoped.or(
          `client_id.eq.${clientId},project_id.in.(${projectIds.join(',')})`,
        );
      });
      return enrichTaskRows(client, rows, 'work');
    } catch (err) {
      console.error(
        '[tasks.loader] loadTasksForClient error:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  },
);

/** Tasks linked to this team account’s projects, CRM clients, or jobs (RLS + scoped IDs). */
export const loadTasksForTeamAccount = cache(
  async (accountId: string): Promise<TasksPageTask[]> => {
    const userClient = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    let scopedDb: SupabaseClient;
    try {
      scopedDb = await getDbForWorkspaceTaskAssignmentOptions(
        userClient,
        user.id,
        accountId,
      );
    } catch {
      return [];
    }

    const { data: accountData } = await scopedDb
      .from('accounts')
      .select('name, slug')
      .eq('id', accountId)
      .maybeSingle();

    const workspaceFallback = {
      name: accountData?.name?.trim() || 'Workspace',
      slug: accountData?.slug?.trim() || null,
    };

    // Prefer account_id scoping over OR(project_id IN …, client_id IN …) —
    // those ID lists grow with the CRM and blow up PostgREST URL / planner cost.
    try {
      const rows = await fetchActiveThenCompletedTaskRows(userClient, (q) =>
        q.eq('account_id', accountId),
      );
      return enrichTaskRows(
        userClient,
        rows,
        'work',
        scopedDb,
        true,
        workspaceFallback,
      );
    } catch (err) {
      console.error(
        '[tasks.loader] loadTasksForTeamAccount error:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  },
);
