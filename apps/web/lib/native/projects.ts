import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
  PROJECT_PRIMARY_CLIENT_EMBED,
} from '~/lib/projects/delivery-project-db';
import type { ProjectStatus } from '~/lib/projects/project-statuses';

import { NativeHttpError } from './http';
import {
  type NativeProject,
  type NativeProjectDetail,
  type NativeProjectProgressRow,
  type NativeProjectRow,
  type NativeProjectStatusColumn,
  type NativeProjectTask,
  closedNativeProjectStatusSlugs,
  countNativeProjectTasks,
  defaultNativeProjectStatuses,
  firstClientEmbed,
  mapNativePhase,
  mapNativeProject,
  mapNativeProjectStatusColumns,
  nativeProjectClientName,
  parseNativeProjectListStatus,
  parseOptionalProjectId,
  progressFromTaskRows,
  workspaceShowsNativeProjects,
} from './projects-shared';
import {
  type NativeTaskClientRow,
  type NativeTaskRow,
  nativeClientName,
  toNativeTask,
} from './task-map';
import type { NativeWorkspace } from './workspace-shared';

export type {
  NativeProject,
  NativeProjectDetail,
  NativeProjectPhase,
  NativeProjectStatusColumn,
  NativeProjectTask,
} from './projects-shared';
export {
  NATIVE_PROJECT_WORKSPACE_PROFILES,
  mapNativeProject,
  parseNativeProjectListStatus,
  workspaceShowsNativeProjects,
} from './projects-shared';

const PROJECT_LIST_LIMIT = 200;

const PROJECT_SELECT = [
  'id',
  'name',
  'title',
  'status',
  'description',
  'client_id',
  'start_date',
  'due_date',
  'is_ongoing',
  'is_phased',
  'value_pence',
  'project_type',
  'created_at',
  PROJECT_PRIMARY_CLIENT_EMBED,
].join(', ');

const PROJECT_SELECT_BARE = [
  'id',
  'name',
  'title',
  'status',
  'description',
  'client_id',
  'start_date',
  'due_date',
  'is_ongoing',
  'is_phased',
  'value_pence',
  'project_type',
  'created_at',
].join(', ');

const PROJECT_TASK_SELECT =
  'id, title, status, due_date, duration_minutes, account_id, user_id, assignee_contact_id, client_id, project_id, phase_id, parent_task_id';

const PROJECT_TASK_SELECT_BASIC =
  'id, title, status, due_date, duration_minutes, account_id, user_id, assignee_contact_id, client_id, project_id, phase_id';

type ProjectPhaseRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  is_milestone?: boolean | null;
  colour?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  sort_order?: number | null;
};

export type NativeProjectsList = {
  items: NativeProject[];
  statuses: NativeProjectStatusColumn[];
};

/**
 * Delivery projects for the selected workspace. Personal / family / community
 * return `[]` (not 403) so a stale phone tab never errors.
 */
export async function listNativeProjects(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  options?: { status?: string | null },
): Promise<NativeProjectsList> {
  if (!workspaceShowsNativeProjects(workspace.profile)) {
    return { items: [], statuses: [] };
  }

  const listStatus = parseNativeProjectListStatus(options?.status);
  const statuses = await loadNativeProjectStatuses(client, workspace.id);
  const rows = await loadNativeProjectRows(
    client,
    workspace.id,
    listStatus,
    statuses,
  );
  const extras = await loadProjectListExtras(
    client,
    workspace.id,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => {
      const extra = extras.get(row.id);
      return mapNativeProject(row, {
        statuses,
        progressPct: extra?.progressPct ?? 0,
        taskCounts: extra?.taskCounts,
        clientName:
          nativeProjectClientName(firstClientEmbed(row.clients)) ??
          extra?.clientName ??
          null,
      });
    }),
    statuses: mapNativeProjectStatusColumns(statuses),
  };
}

export async function getNativeProject(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  projectId: string,
): Promise<NativeProjectDetail> {
  if (!workspaceShowsNativeProjects(workspace.profile)) {
    throw new NativeHttpError(404, 'Project not found');
  }

  const id = parseOptionalProjectId(projectId);
  if (!id) {
    throw new NativeHttpError(404, 'Project not found');
  }

  const statuses = await loadNativeProjectStatuses(client, workspace.id);
  const row = await loadNativeProjectRow(client, workspace.id, id);
  if (!row) {
    throw new NativeHttpError(404, 'Project not found');
  }

  const [phases, taskRows] = await Promise.all([
    loadNativeProjectPhases(client, workspace.id, id),
    loadNativeProjectTaskRows(client, workspace.id, id),
  ]);

  const phaseNameById = new Map(
    phases.map((phase) => [phase.id, phase.name?.trim() || 'Untitled phase']),
  );
  const clientNames = await loadClientNames(
    client,
    [row.client_id, ...taskRows.map((task) => task.client_id)].filter(
      (value): value is string => Boolean(value),
    ),
    workspace.id,
  );

  const tasks = taskRows.map((task) =>
    mapNativeProjectTask(task, workspace, phaseNameById, clientNames),
  );
  const taskCounts = countNativeProjectTasks(tasks);
  const progressPct = progressFromTaskRows(taskRows);

  const mappedPhases = phases.map((phase) => {
    const phaseTasks = taskRows.filter((task) => task.phase_id === phase.id);
    return mapNativePhase({
      ...phase,
      progress_pct: progressFromTaskRows(phaseTasks),
      task_count: phaseTasks.length,
    });
  });

  return {
    ...mapNativeProject(row, {
      statuses,
      progressPct,
      taskCounts,
      clientName:
        nativeProjectClientName(firstClientEmbed(row.clients)) ??
        (row.client_id ? (clientNames.get(row.client_id) ?? null) : null),
    }),
    description: row.description?.trim() || null,
    phases: mappedPhases,
    tasks,
    default_board_mode: row.is_phased ? 'phase' : 'progress',
  };
}

function mapNativeProjectTask(
  row: NativeTaskRow & {
    phase_id?: string | null;
    parent_task_id?: string | null;
  },
  workspace: NativeWorkspace,
  phaseNameById: Map<string, string>,
  clientNames: Map<string, string>,
): NativeProjectTask {
  const phaseId = row.phase_id?.trim() || null;
  const task = toNativeTask(
    row,
    workspace,
    row.client_id ? (clientNames.get(row.client_id) ?? null) : null,
  );

  return {
    ...task,
    phase_id: phaseId,
    phase_name: phaseId ? (phaseNameById.get(phaseId) ?? null) : null,
    parent_task_id: row.parent_task_id?.trim() || null,
  };
}

async function loadNativeProjectStatuses(
  client: SupabaseClient,
  accountId: string,
): Promise<ProjectStatus[]> {
  const { data, error } = await client
    .from('project_statuses')
    .select(
      'id, account_id, slug, label, color, sort_order, is_default, category',
    )
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error || !data?.length) {
    return defaultNativeProjectStatuses(accountId);
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    accountId: String(row.account_id ?? accountId),
    slug: String(row.slug),
    label: String(row.label),
    color: String(row.color ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    isDefault: Boolean(row.is_default),
    category:
      row.category === 'completed' || row.category === 'cancelled'
        ? row.category
        : 'open',
  }));
}

function applyListStatusFilter<
  T extends {
    not: (column: string, operator: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  },
>(
  query: T,
  listStatus: ReturnType<typeof parseNativeProjectListStatus>,
  statuses: readonly ProjectStatus[],
): T {
  if (listStatus === 'all') {
    return query;
  }

  const closed = closedNativeProjectStatusSlugs(statuses);
  const closedFilter = `(${closed.map((slug) => `"${slug}"`).join(',')})`;

  if (listStatus === 'done') {
    return query.in('status', closed);
  }

  return query.not('status', 'in', closedFilter);
}

async function loadNativeProjectRows(
  client: SupabaseClient,
  accountId: string,
  listStatus: ReturnType<typeof parseNativeProjectListStatus>,
  statuses: readonly ProjectStatus[],
): Promise<NativeProjectRow[]> {
  const run = async (select: string, withType: boolean) => {
    let query = client
      .from(PROJECTS_TABLE)
      .select(select)
      .eq('account_id', accountId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(PROJECT_LIST_LIMIT);

    if (withType) {
      query = query.eq('project_type', DELIVERY_PROJECT_FILTER.project_type);
    }

    query = applyListStatusFilter(query, listStatus, statuses);
    return query;
  };

  let result = await run(PROJECT_SELECT, true);

  if (result.error) {
    const blob = `${result.error.message ?? ''}`.toLowerCase();
    const omitType = blob.includes('project_type');
    const omitEmbed =
      blob.includes('more than one relationship') ||
      blob.includes('could not find');

    result = await run(
      omitEmbed ? PROJECT_SELECT_BARE : PROJECT_SELECT,
      !omitType,
    );
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = (result.data ?? []) as unknown as NativeProjectRow[];
  return hydrateMissingClients(client, accountId, rows);
}

async function loadNativeProjectRow(
  client: SupabaseClient,
  accountId: string,
  projectId: string,
): Promise<NativeProjectRow | null> {
  const run = async (select: string, withType: boolean) => {
    let query = client
      .from(PROJECTS_TABLE)
      .select(select)
      .eq('account_id', accountId)
      .eq('id', projectId);

    if (withType) {
      query = query.eq('project_type', DELIVERY_PROJECT_FILTER.project_type);
    }

    return query.maybeSingle();
  };

  let result = await run(PROJECT_SELECT, true);

  if (result.error) {
    const blob = `${result.error.message ?? ''}`.toLowerCase();
    const omitType = blob.includes('project_type');
    const omitEmbed =
      blob.includes('more than one relationship') ||
      blob.includes('could not find');

    result = await run(
      omitEmbed ? PROJECT_SELECT_BARE : PROJECT_SELECT,
      !omitType,
    );
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = (result.data as unknown as NativeProjectRow | null) ?? null;
  if (!row) return null;

  const [hydrated] = await hydrateMissingClients(client, accountId, [row]);
  return hydrated ?? row;
}

async function hydrateMissingClients(
  client: SupabaseClient,
  accountId: string,
  rows: NativeProjectRow[],
): Promise<NativeProjectRow[]> {
  const missing = rows.filter(
    (row) => row.client_id && !firstClientEmbed(row.clients),
  );
  if (missing.length === 0) {
    return rows;
  }

  const names = await loadClientNameRows(
    client,
    missing.map((row) => row.client_id as string),
    accountId,
  );

  return rows.map((row) => {
    if (!row.client_id || firstClientEmbed(row.clients)) {
      return row;
    }

    const clientRow = names.get(row.client_id);
    return clientRow ? { ...row, clients: clientRow } : row;
  });
}

async function loadProjectListExtras(
  client: SupabaseClient,
  accountId: string,
  projectIds: string[],
): Promise<
  Map<
    string,
    {
      progressPct: number;
      taskCounts: ReturnType<typeof countNativeProjectTasks>;
      clientName?: string | null;
    }
  >
> {
  const extras = new Map<
    string,
    {
      progressPct: number;
      taskCounts: ReturnType<typeof countNativeProjectTasks>;
      clientName?: string | null;
    }
  >();

  if (projectIds.length === 0) {
    return extras;
  }

  const { data, error } = await client
    .from('tasks')
    .select('id, project_id, status, parent_task_id, duration_minutes')
    .eq('account_id', accountId)
    .in('project_id', projectIds)
    .is('assignee_contact_id', null);

  if (error) {
    return extras;
  }

  const byProject = new Map<string, NativeProjectProgressRow[]>();
  for (const row of (data ?? []) as NativeProjectProgressRow[]) {
    const projectId = row.project_id?.trim();
    if (!projectId) continue;
    const list = byProject.get(projectId) ?? [];
    list.push(row);
    byProject.set(projectId, list);
  }

  for (const projectId of projectIds) {
    const rows = byProject.get(projectId) ?? [];
    extras.set(projectId, {
      progressPct: progressFromTaskRows(rows),
      taskCounts: countNativeProjectTasks(rows),
    });
  }

  return extras;
}

async function loadNativeProjectPhases(
  client: SupabaseClient,
  accountId: string,
  projectId: string,
): Promise<ProjectPhaseRow[]> {
  const { data, error } = await client
    .from('project_phases')
    .select(
      'id, name, status, is_milestone, colour, start_date, due_date, sort_order',
    )
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as ProjectPhaseRow[];
}

async function loadNativeProjectTaskRows(
  client: SupabaseClient,
  accountId: string,
  projectId: string,
): Promise<
  Array<
    NativeTaskRow & {
      phase_id?: string | null;
      parent_task_id?: string | null;
      project_id?: string | null;
    }
  >
> {
  const primary = await client
    .from('tasks')
    .select(PROJECT_TASK_SELECT)
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .is('assignee_contact_id', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const fallback = primary.error
    ? await client
        .from('tasks')
        .select(PROJECT_TASK_SELECT_BASIC)
        .eq('account_id', accountId)
        .eq('project_id', projectId)
        .is('assignee_contact_id', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
    : primary;

  if (fallback.error) {
    return [];
  }

  return (fallback.data ?? []) as unknown as Array<
    NativeTaskRow & {
      phase_id?: string | null;
      parent_task_id?: string | null;
    }
  >;
}

async function loadClientNames(
  client: SupabaseClient,
  clientIds: string[],
  accountId?: string,
): Promise<Map<string, string>> {
  const rows = await loadClientNameRows(client, clientIds, accountId);
  const names = new Map<string, string>();
  for (const [id, row] of rows) {
    const name = nativeClientName(row);
    if (name) names.set(id, name);
  }
  return names;
}

async function loadClientNameRows(
  client: SupabaseClient,
  clientIds: string[],
  accountId?: string,
): Promise<Map<string, NativeTaskClientRow>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  const map = new Map<string, NativeTaskClientRow>();
  if (unique.length === 0) {
    return map;
  }

  let query = client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .in('id', unique);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;
  if (error) {
    return map;
  }

  for (const row of (data ?? []) as NativeTaskClientRow[]) {
    map.set(row.id, row);
  }

  return map;
}
