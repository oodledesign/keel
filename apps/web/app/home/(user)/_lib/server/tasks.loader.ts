import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';

/** Cap task payloads for faster SSR and hydration. */
export const TASK_LIST_LIMIT = 300;

const TASK_SELECT =
  'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, notes, calendar_schedule_status';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { parseDueDateParts, toIsoDateString } from '../../../_lib/due-date-ymd';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';
import { workspaceColorForSpaceType } from '../workspace-accent';

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
  notes?: string | null;
  calendar_schedule_status?: string | null;
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

type JobEnrichment = never;

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
  clientId: string | null;
  projectId: string | null;
  areaId: string | null;
  clientName: string | null;
  clientPictureUrl: string | null;
  /** Team account (workspace) for work tasks — from linked project or client. */
  workspaceName: string | null;
  workspaceSlug: string | null;
  /** Accent for cross-workspace list chips (business colour or space-type default). */
  workspaceColor: string | null;
  parentTaskId: string | null;
  notes: string | null;
  calendarScheduleStatus: 'scheduled' | 'failed' | null;
  /** Populated for root tasks only (see `nestTaskTree`). */
  subtasks?: TasksPageTask[];
};

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
    const workspace = workspaceFromAccountId(client.account_id, maps.accountsById);
    next.workspaceName = workspace.name;
    next.workspaceSlug = workspace.slug;
  }

  return next;
}

function taskRowToPageTask(
  row: TaskQueryRow,
  maps: {
    projects: Map<string, ProjectEnrichment>;
    clients: Map<string, ClientEnrichment>;
    areas: Map<string, AreaEnrichment>;
    accountsById: Map<string, AccountWorkspaceRow>;
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
        : p?.name ?? null;
    const biz = p?.businesses;
    accentColor = biz?.colour ?? null;
    resolvedAccountId = p?.account_id ?? biz?.account_id ?? null;
    const ws = workspaceFromAccountId(resolvedAccountId, maps.accountsById);
    workspaceName = ws.name;
    workspaceSlug = ws.slug;
  }
  if (row.client_id) {
    const resolved = applyClientContext(
      row.client_id,
      maps,
      {
        clientName,
        resolvedAccountId,
        workspaceName,
        workspaceSlug,
      },
    );
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
      accentColor ?? workspaceColorForSpaceType(accountRow?.space_type ?? 'work');
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
    clientId: row.client_id ?? null,
    projectId: row.project_id ?? null,
    areaId: row.area_id ?? null,
    clientName,
    clientPictureUrl,
    workspaceName,
    workspaceSlug,
    workspaceColor,
    parentTaskId: row.parent_task_id ?? null,
    notes: row.notes?.trim() ? row.notes : null,
    calendarScheduleStatus:
      row.calendar_schedule_status === 'scheduled' ||
      row.calendar_schedule_status === 'failed'
        ? row.calendar_schedule_status
        : null,
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
  return flat
    .filter((t) => !t.parentTaskId)
    .map((t) => ({
      ...t,
      subtasks: byParent.get(t.id) ?? [],
    }));
}

async function enrichTaskRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  rows: TaskQueryRow[],
  contextOverride?: 'work' | 'life',
  /** Use for project/client names when session RLS hides rows (e.g. team workspace). */
  enrichmentClient?: SupabaseClient,
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
          .select('id, display_name, first_name, last_name, account_id, picture_url')
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

  const maps = { projects, clients, areas, accountsById };

  const flat = rows.map((row) =>
    taskRowToPageTask(row, maps, contextOverride, workspaceFallback),
  );
  return nest ? nestTaskTree(flat) : flat;
}

/** Load a single task for the edit dialog (dashboard quick-open, etc.). */
export async function loadTaskById(
  taskId: string,
  options?: { workspaceAccountId?: string },
): Promise<TasksPageTask | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, notes, calendar_schedule_status',
    )
    .eq('id', taskId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  let enrichmentClient: SupabaseClient | undefined;

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
    [data as TaskQueryRow],
    options?.workspaceAccountId ? 'work' : undefined,
    enrichmentClient,
    false,
  );

  const task = tasks[0] ?? null;

  if (!task || task.parentTaskId) {
    return task;
  }

  const { data: childRows, error: childError } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, notes, calendar_schedule_status',
    )
    .eq('user_id', user.id)
    .eq('parent_task_id', taskId)
    .order('due_date', { ascending: true, nullsLast: true });

  if (childError || !childRows?.length) {
    return { ...task, subtasks: [] };
  }

  const subtasks = await enrichTaskRows(
    client,
    childRows as TaskQueryRow[],
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

export const loadTasksForUser = cache(async (): Promise<TasksPageTask[]> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsLast: true })
    .limit(TASK_LIST_LIMIT);

  if (error) {
    console.error('[tasks.loader] loadTasksForUser error:', error.message);
    return [];
  }

  return enrichTaskRows(client, (data ?? []) as TaskQueryRow[]);
});

/** Tasks for a specific client (current user's tasks linked to this client). */
export const loadTasksForClient = cache(
  async (clientId: string): Promise<TasksPageTask[]> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { data, error } = await client
      .from('tasks')
      .select(TASK_SELECT)
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .order('due_date', { ascending: true, nullsLast: true })
      .limit(TASK_LIST_LIMIT);

    if (error) {
      console.error('[tasks.loader] loadTasksForClient error:', error.message);
      return [];
    }

    return enrichTaskRows(client, (data ?? []) as TaskQueryRow[], 'work');
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

    const [{ data: projectsData }, { data: clientsData }, { data: accountData }] =
      await Promise.all([
        scopedDb.from('projects').select('id').eq('account_id', accountId),
        scopedDb.from('clients').select('id').eq('account_id', accountId),
        scopedDb
          .from('accounts')
          .select('name, slug')
          .eq('id', accountId)
          .maybeSingle(),
      ]);

    const workspaceFallback = {
      name: accountData?.name?.trim() || 'Workspace',
      slug: accountData?.slug?.trim() || null,
    };

    const projectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
    const clientIds = (clientsData ?? []).map((c: { id: string }) => c.id);

    if (projectIds.length === 0 && clientIds.length === 0) {
      const { data: accountOnlyData, error: accountOnlyError } = await userClient
        .from('tasks')
        .select(TASK_SELECT)
        .eq('account_id', accountId)
        .order('due_date', { ascending: true, nullsLast: true })
        .limit(TASK_LIST_LIMIT);

      if (accountOnlyError) {
        console.error(
          '[tasks.loader] loadTasksForTeamAccount error:',
          accountOnlyError.message,
        );
        return [];
      }

      return enrichTaskRows(
        userClient,
        (accountOnlyData ?? []) as TaskQueryRow[],
        'work',
        scopedDb,
        true,
        workspaceFallback,
      );
    }

    let query = userClient.from('tasks').select(TASK_SELECT);

    const filters: string[] = [`account_id.eq.${accountId}`];
    if (projectIds.length > 0) {
      filters.push(`project_id.in.(${projectIds.join(',')})`);
    }
    if (clientIds.length > 0) {
      filters.push(`client_id.in.(${clientIds.join(',')})`);
    }

    query = query.or(filters.join(','));

    const { data, error } = await query
      .order('due_date', {
        ascending: true,
        nullsLast: true,
      })
      .limit(TASK_LIST_LIMIT);

    if (error) {
      console.error(
        '[tasks.loader] loadTasksForTeamAccount error:',
        error.message,
      );
      return [];
    }

    return enrichTaskRows(
      userClient,
      (data ?? []) as TaskQueryRow[],
      'work',
      scopedDb,
      true,
      workspaceFallback,
    );
  },
);
