import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  isCalendarOverdueYmd,
  parseDueDateParts,
  todayLocalYmd,
} from '~/home/_lib/due-date-ymd';
import { loadPersonalIncludeWorkspaceTasks } from '~/lib/personal-preferences/load-unified-tasks-preference';

const TASK_LIST_LIMIT = 300;

const TASK_SELECT =
  'id, title, status, priority, due_date, project_id, client_id, area_id, account_id, parent_task_id, notes';

type TaskRow = {
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
};

type AccountRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  space_type?: string | null;
};

type ClientRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  account_id?: string | null;
};

type ProjectRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  project_type?: string | null;
  account_id?: string | null;
};

type AreaRow = {
  id: string;
  name?: string | null;
};

export type RecorderTodayTask = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'client_review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  due_date_label: string | null;
  overdue: boolean;
  workspace_name: string | null;
  workspace_slug: string | null;
  client_name: string | null;
  project_name: string | null;
  subtitle: string | null;
  detail_path: string | null;
  account_id: string | null;
};

export type RecorderTodayPayload = {
  date: string;
  planner_day_path: string;
  tasks_path: string;
  tasks_due_today: RecorderTodayTask[];
  overdue_tasks: RecorderTodayTask[];
  all_open_tasks: RecorderTodayTask[];
};

function mapTaskStatus(
  status: string | null | undefined,
): RecorderTodayTask['status'] {
  switch ((status ?? '').toLowerCase()) {
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

function mapPriority(
  priority: string | null | undefined,
): RecorderTodayTask['priority'] {
  const raw = String(priority ?? 'medium').trim().toLowerCase();
  if (raw === 'low' || raw === 'high' || raw === 'urgent') return raw;
  return 'medium';
}

function formatDueDateLabel(due: string | null): string | null {
  const parts = parseDueDateParts(due);
  if (!parts) return null;
  const date = new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function clientDisplayName(client: ClientRow): string | null {
  const displayName = client.display_name?.trim();
  if (displayName) return displayName;
  const fullName = [client.first_name, client.last_name]
    .filter((value): value is string => Boolean(value && String(value).trim()))
    .map((value) => String(value).trim())
    .join(' ');
  return fullName || null;
}

function projectDisplayName(project: ProjectRow): string | null {
  if (project.project_type === 'campaign') {
    return project.name?.trim() || null;
  }
  return project.title?.trim() || project.name?.trim() || null;
}

function isWorkTask(row: TaskRow): boolean {
  return Boolean(row.project_id || row.client_id || row.account_id);
}

function taskDetailPath(
  accountId: string | null,
  accountsById: Map<string, AccountRow>,
): string | null {
  if (!accountId) {
    return `${pathsConfig.app.home}/tasks`;
  }
  const account = accountsById.get(accountId);
  const slug = account?.slug?.trim();
  if (!slug) {
    return `${pathsConfig.app.home}/tasks`;
  }
  return workAccountPath(pathsConfig.app.accountTasks, slug);
}

function buildSubtitle(parts: Array<string | null | undefined>): string | null {
  const filtered = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (filtered.length === 0) return null;
  return filtered.join(' · ');
}

function rowToRecorderTask(
  row: TaskRow,
  maps: {
    accountsById: Map<string, AccountRow>;
    clients: Map<string, ClientRow>;
    projects: Map<string, ProjectRow>;
    areas: Map<string, AreaRow>;
  },
  todayYmd: string,
): RecorderTodayTask {
  const dueDate = row.due_date?.trim() || null;
  const overdue = isCalendarOverdueYmd(dueDate);
  const status = mapTaskStatus(row.status);
  const accountId = row.account_id?.trim() || null;

  let workspaceName: string | null = null;
  let workspaceSlug: string | null = null;
  let clientName: string | null = null;
  let projectName: string | null = null;

  if (row.client_id) {
    const client = maps.clients.get(row.client_id);
    if (client) {
      clientName = clientDisplayName(client);
      const clientAccountId = client.account_id ?? accountId;
      if (clientAccountId) {
        const account = maps.accountsById.get(clientAccountId);
        workspaceName = account?.name?.trim() || null;
        workspaceSlug = account?.slug?.trim() || null;
      }
    }
  }

  if (row.project_id) {
    const project = maps.projects.get(row.project_id);
    if (project) {
      projectName = projectDisplayName(project);
      const projectAccountId = project.account_id ?? accountId;
      if (projectAccountId && !workspaceName) {
        const account = maps.accountsById.get(projectAccountId);
        workspaceName = account?.name?.trim() || null;
        workspaceSlug = account?.slug?.trim() || null;
      }
    }
  }

  if (!workspaceName && accountId) {
    const account = maps.accountsById.get(accountId);
    workspaceName = account?.name?.trim() || null;
    workspaceSlug = account?.slug?.trim() || null;
  }

  if (!workspaceName && row.area_id) {
    const area = maps.areas.get(row.area_id);
    workspaceName = area?.name?.trim() || 'Personal';
  }

  if (!workspaceName) {
    workspaceName = isWorkTask(row) ? 'Workspace' : 'Personal';
  }

  const resolvedAccountId =
    accountId ||
    maps.clients.get(row.client_id ?? '')?.account_id ||
    maps.projects.get(row.project_id ?? '')?.account_id ||
    null;

  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled task',
    status,
    priority: mapPriority(row.priority),
    due_date: dueDate,
    due_date_label: formatDueDateLabel(dueDate),
    overdue,
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug,
    client_name: clientName,
    project_name: projectName,
    subtitle: buildSubtitle([workspaceName, clientName ?? projectName]),
    detail_path: taskDetailPath(resolvedAccountId, maps.accountsById),
    account_id: resolvedAccountId,
  };
}

function sortTasks(a: RecorderTodayTask, b: RecorderTodayTask): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const aDue = a.due_date ?? '9999-12-31';
  const bDue = b.due_date ?? '9999-12-31';
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }
  return a.title.localeCompare(b.title);
}

async function loadMaps(
  admin: SupabaseClient,
  rows: TaskRow[],
): Promise<{
  accountsById: Map<string, AccountRow>;
  clients: Map<string, ClientRow>;
  projects: Map<string, ProjectRow>;
  areas: Map<string, AreaRow>;
}> {
  const accountIds = new Set<string>();
  const clientIds = new Set<string>();
  const projectIds = new Set<string>();
  const areaIds = new Set<string>();

  for (const row of rows) {
    if (row.account_id) accountIds.add(row.account_id);
    if (row.client_id) clientIds.add(row.client_id);
    if (row.project_id) projectIds.add(row.project_id);
    if (row.area_id) areaIds.add(row.area_id);
  }

  const [accountsResult, clientsResult, projectsResult, areasResult] =
    await Promise.all([
      accountIds.size > 0
        ? admin
            .from('accounts')
            .select('id, name, slug, space_type')
            .in('id', [...accountIds])
        : Promise.resolve({ data: [] as AccountRow[] }),
      clientIds.size > 0
        ? admin
            .from('clients')
            .select('id, display_name, first_name, last_name, account_id')
            .in('id', [...clientIds])
        : Promise.resolve({ data: [] as ClientRow[] }),
      projectIds.size > 0
        ? admin
            .from('projects')
            .select('id, name, title, project_type, account_id')
            .in('id', [...projectIds])
        : Promise.resolve({ data: [] as ProjectRow[] }),
      areaIds.size > 0
        ? admin
            .from('areas')
            .select('id, name')
            .in('id', [...areaIds])
        : Promise.resolve({ data: [] as AreaRow[] }),
    ]);

  return {
    accountsById: new Map(
      ((accountsResult.data ?? []) as AccountRow[]).map((row) => [row.id, row]),
    ),
    clients: new Map(
      ((clientsResult.data ?? []) as ClientRow[]).map((row) => [row.id, row]),
    ),
    projects: new Map(
      ((projectsResult.data ?? []) as ProjectRow[]).map((row) => [row.id, row]),
    ),
    areas: new Map(
      ((areasResult.data ?? []) as AreaRow[]).map((row) => [row.id, row]),
    ),
  };
}

export async function loadRecorderToday(userId: string): Promise<RecorderTodayPayload> {
  const admin = getSupabaseServerAdminClient();
  const todayYmd = todayLocalYmd();
  const includeWorkspaceTasks = await loadPersonalIncludeWorkspaceTasks(
    admin,
    userId,
  );

  const { data, error } = await admin
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(TASK_LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as TaskRow[];
  const maps = await loadMaps(admin, rows);

  const openTasks = rows
    .map((row) => rowToRecorderTask(row, maps, todayYmd))
    .filter((task) => task.status !== 'completed')
    .filter((task) => {
      if (includeWorkspaceTasks) return true;
      const row = rows.find((candidate) => candidate.id === task.id);
      return row ? !isWorkTask(row) : true;
    });

  const tasksDueToday = openTasks
    .filter((task) => task.due_date === todayYmd)
    .sort(sortTasks);

  const overdueTasks = openTasks
    .filter((task) => task.overdue)
    .sort(sortTasks);

  const allOpenTasks = [...openTasks].sort(sortTasks);

  return {
    date: todayYmd,
    planner_day_path: pathsConfig.app.personalPlannerDay,
    tasks_path: `${pathsConfig.app.home}/tasks`,
    tasks_due_today: tasksDueToday,
    overdue_tasks: overdueTasks,
    all_open_tasks: allOpenTasks,
  };
}
