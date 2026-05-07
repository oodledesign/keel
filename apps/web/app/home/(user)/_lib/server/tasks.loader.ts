import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

type TaskQueryRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  area_id?: string | null;
};

type ProjectEnrichment = {
  id: string;
  name?: string | null;
  account_id?: string | null;
  businesses?: { colour?: string | null } | null;
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
  status: 'pending' | 'in_progress' | 'completed';
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
): 'pending' | 'in_progress' | 'completed' {
  switch ((status ?? '').toLowerCase()) {
    case 'todo':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'done':
    case 'cancelled':
      return 'completed';
    default:
      return 'pending';
  }
}

function formatDueDateLabel(due: string | null): string {
  if (!due) return '';
  const date = new Date(due);
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

  if (row.project_id) {
    const p = maps.projects.get(row.project_id);
    projectName = p?.name ?? null;
    accentColor = p?.businesses?.colour ?? null;
    const ws = workspaceFromAccountId(p?.account_id, maps.accountsById);
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
      if (!workspaceName) {
        const ws = workspaceFromAccountId(c.account_id, maps.accountsById);
        workspaceName = ws.name;
        workspaceSlug = ws.slug;
      }
    }
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
    dueDate: dueDateRaw ? String(dueDateRaw).slice(0, 10) : null,
    accentColor,
    clientId: row.client_id ?? null,
    projectId: row.project_id ?? null,
    areaId: row.area_id ?? null,
    clientName,
    workspaceName,
    workspaceSlug,
  };
}

async function enrichTaskRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  rows: TaskQueryRow[],
  contextOverride?: 'work' | 'life',
  /** Use for project/client names when session RLS hides rows (e.g. team workspace). */
  enrichmentClient?: SupabaseClient,
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
          .select('id, name, account_id, businesses(colour)')
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
      .select('id, name, slug')
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

  return rows.map((row) => taskRowToPageTask(row, maps, contextOverride));
}

export const loadTasksForUser = cache(async (): Promise<TasksPageTask[]> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, project_id, client_id, area_id',
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
        'id, title, status, priority, due_date, project_id, client_id, area_id',
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

/** Current user's tasks linked to this team account via projects or CRM clients. */
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

    let query = userClient
      .from('tasks')
      .select(
        'id, title, status, priority, due_date, project_id, client_id, area_id',
      )
      .eq('user_id', user.id);

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
