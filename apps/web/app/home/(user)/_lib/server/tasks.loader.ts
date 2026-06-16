import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { parseDueDateParts, toIsoDateString } from '../../../_lib/due-date-ymd';
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
  parent_task_id?: string | null;
  notes?: string | null;
};

type BusinessEnrichment = {
  colour?: string | null;
  account_id?: string | null;
};

type ProjectEnrichment = {
  id: string;
  name?: string | null;
  account_id?: string | null;
  business_id?: string | null;
  businesses?: BusinessEnrichment | null;
};

type ClientEnrichment = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  account_id?: string | null;
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
  /** Team account (workspace) for work tasks — from linked project or client. */
  workspaceName: string | null;
  workspaceSlug: string | null;
  /** Accent for cross-workspace list chips (business colour or space-type default). */
  workspaceColor: string | null;
  parentTaskId: string | null;
  notes: string | null;
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

function taskRowToPageTask(
  row: TaskQueryRow,
  maps: {
    projects: Map<string, ProjectEnrichment>;
    clients: Map<string, ClientEnrichment>;
    areas: Map<string, AreaEnrichment>;
    accountsById: Map<string, AccountWorkspaceRow>;
  },
  contextOverride?: 'work' | 'life',
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
    projectName = p?.name ?? null;
    const biz = p?.businesses;
    accentColor = biz?.colour ?? null;
    resolvedAccountId = p?.account_id ?? biz?.account_id ?? null;
    const ws = workspaceFromAccountId(resolvedAccountId, maps.accountsById);
    workspaceName = ws.name;
    workspaceSlug = ws.slug;
  }
  if (row.client_id) {
    const c = maps.clients.get(row.client_id);
    if (c) {
      const dn = c.display_name?.trim();
      clientName =
        dn ||
        [c.first_name, c.last_name]
          .filter((x): x is string => Boolean(x && String(x).trim()))
          .map((x) => String(x).trim())
          .join(' ') ||
        null;
      if (!resolvedAccountId) {
        resolvedAccountId = c.account_id ?? null;
      }
      if (!workspaceName) {
        const ws = workspaceFromAccountId(c.account_id, maps.accountsById);
        workspaceName = ws.name;
        workspaceSlug = ws.slug;
      }
    }
  }

  if (resolvedAccountId) {
    const accountRow = maps.accountsById.get(resolvedAccountId);
    workspaceColor =
      accentColor ?? workspaceColorForSpaceType(accountRow?.space_type ?? 'work');
  } else if (!row.project_id && !row.client_id) {
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
    contextOverride ??
    (row.project_id || row.client_id ? 'work' : 'life');

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
    workspaceName,
    workspaceSlug,
    workspaceColor,
    parentTaskId: row.parent_task_id ?? null,
    notes: row.notes?.trim() ? row.notes : null,
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
): Promise<TasksPageTask[]> {
  const rowDb = enrichmentClient ?? client;

  const projectIds = [
    ...new Set(rows.map((r) => r.project_id).filter(Boolean)),
  ] as string[];
  const clientIds = [
    ...new Set(rows.map((r) => r.client_id).filter(Boolean)),
  ] as string[];
  const areaIds = [
    ...new Set(rows.map((r) => r.area_id).filter(Boolean)),
  ] as string[];

  const [projectsResult, clientsResult, areasResult] = await Promise.all([
    projectIds.length > 0
      ? rowDb
          .from('projects')
          .select('id, name, account_id, business_id, businesses(colour, account_id)')
          .in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectEnrichment[] }),
    clientIds.length > 0
      ? rowDb
          .from('clients')
          .select('id, display_name, first_name, last_name, account_id')
          .in('id', clientIds)
      : Promise.resolve({ data: [] as ClientEnrichment[] }),
    areaIds.length > 0
      ? client.from('areas').select('id, name, colour').in('id', areaIds)
      : Promise.resolve({ data: [] as AreaEnrichment[] }),
  ]);

  const projects = new Map<string, ProjectEnrichment>();
  for (const p of (projectsResult.data ?? []) as ProjectEnrichment[]) {
    projects.set(p.id, p);
  }
  const clients = new Map<string, ClientEnrichment>();
  for (const c of (clientsResult.data ?? []) as ClientEnrichment[]) {
    clients.set(c.id, c);
  }
  const areas = new Map<string, AreaEnrichment>();
  for (const a of (areasResult.data ?? []) as AreaEnrichment[]) {
    areas.set(a.id, a);
  }

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
  for (const c of clients.values()) {
    if (c.account_id) {
      accountIdSet.add(c.account_id);
    }
  }
  const uniqueAccountIds = [...accountIdSet];

  const accountsById = new Map<string, AccountWorkspaceRow>();
  if (uniqueAccountIds.length > 0) {
    const { data: accountRows, error: accountsErr } = await rowDb
      .from('accounts')
      .select('id, name, slug, space_type')
      .in('id', uniqueAccountIds);

    if (accountsErr) {
      console.error(
        '[tasks.loader] enrichTaskRows accounts:',
        accountsErr.message,
      );
    }

    for (const r of (accountRows ?? []) as AccountWorkspaceRow[]) {
      if (r.id) {
        accountsById.set(r.id, r);
      }
    }
  }

  const maps = { projects, clients, areas, accountsById };

  const flat = rows.map((row) => taskRowToPageTask(row, maps, contextOverride));
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
      'id, title, status, priority, due_date, project_id, client_id, area_id, parent_task_id, notes',
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

  return tasks[0] ?? null;
}

export const loadTasksForUser = cache(async (): Promise<TasksPageTask[]> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, project_id, client_id, area_id, parent_task_id, notes',
    )
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsLast: true });

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
      .select(
        'id, title, status, priority, due_date, project_id, client_id, area_id, parent_task_id, notes',
      )
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .order('due_date', { ascending: true, nullsLast: true });

    if (error) {
      console.error('[tasks.loader] loadTasksForClient error:', error.message);
      return [];
    }

    return enrichTaskRows(client, (data ?? []) as TaskQueryRow[], 'work');
  },
);

/** Tasks linked to this team account’s projects or CRM clients (RLS + project/client ID scope). */
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

    const [{ data: projectsData }, { data: clientsData }] = await Promise.all([
      scopedDb.from('projects').select('id').eq('account_id', accountId),
      scopedDb.from('clients').select('id').eq('account_id', accountId),
    ]);

    const projectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
    const clientIds = (clientsData ?? []).map((c: { id: string }) => c.id);

    if (projectIds.length === 0 && clientIds.length === 0) {
      return [];
    }

    // Do not filter by user_id here: RLS already limits rows to tasks you may see
    // (your own or workspace-linked). Scoping to this account’s project/client IDs
    // keeps the list aligned with the workspace surface.
    let query = userClient.from('tasks').select(
      'id, title, status, priority, due_date, project_id, client_id, area_id, parent_task_id, notes',
    );

    if (projectIds.length > 0 && clientIds.length > 0) {
      query = query.or(
        `project_id.in.(${projectIds.join(',')}),client_id.in.(${clientIds.join(',')})`,
      );
    } else if (projectIds.length > 0) {
      query = query.in('project_id', projectIds);
    } else {
      query = query.in('client_id', clientIds);
    }

    const { data, error } = await query.order('due_date', {
      ascending: true,
      nullsLast: true,
    });

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
    );
  },
);
