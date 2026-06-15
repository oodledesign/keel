'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import type { TasksPageTask } from '../server/tasks.loader';
import { loadTasksForClient } from '../server/tasks.loader';

const TASK_DB_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

/** Maps UI / AI labels to values allowed by `tasks_priority_check` in the database. */
function normalizeTaskPriorityForDb(
  input: string | undefined | null,
): string {
  const raw = String(input ?? 'medium').trim().toLowerCase();
  if (TASK_DB_PRIORITIES.has(raw)) return raw;
  if (raw === 'normal' || raw === 'default') return 'medium';
  return 'medium';
}

export type CreateTaskInput = {
  title: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  areaId?: string;
  clientId?: string;
  /** When set, inherits project/client/area from parent if those are omitted. */
  parentTaskId?: string;
  notes?: string | null;
};

export async function createTask(input: CreateTaskInput) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  let projectId = input.projectId || null;
  let clientId = input.clientId || null;
  let areaId = input.areaId || null;

  if (input.parentTaskId) {
    const { data: parent, error: pe } = await client
      .from('tasks')
      .select('user_id, project_id, client_id, area_id')
      .eq('id', input.parentTaskId)
      .maybeSingle();

    if (pe || !parent || (parent as { user_id: string }).user_id !== user.id) {
      return {
        success: false,
        error: 'Parent task not found',
        id: null,
      };
    }
    const p = parent as {
      project_id: string | null;
      client_id: string | null;
      area_id: string | null;
    };
    projectId = projectId ?? p.project_id;
    clientId = clientId ?? p.client_id;
    areaId = areaId ?? p.area_id;
  }

  const insertRow: Record<string, unknown> = {
    title: input.title,
    priority: normalizeTaskPriorityForDb(input.priority),
    due_date: input.dueDate || null,
    project_id: projectId,
    area_id: areaId,
    client_id: clientId,
    user_id: user.id,
    status: 'todo',
  };

  if (input.parentTaskId) {
    insertRow.parent_task_id = input.parentTaskId;
  }
  if (input.notes?.trim()) {
    insertRow.notes = input.notes.trim();
  }

  const { data, error } = await client
    .from('tasks')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    const msg =
      error.message?.includes("'client_id'") &&
      error.message?.toLowerCase().includes('schema cache')
        ? "Tasks table is missing the client_id column. Run migrations (e.g. pnpm supabase:web:reset or supabase db push from apps/web) then pnpm --filter web supabase:typegen."
        : error.message;
    return { success: false, error: msg, id: null };
  }

  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true, error: null, id: data.id as string };
}

function uiStatusToDb(
  status: string,
): 'todo' | 'in_progress' | 'client_review' | 'done' | 'cancelled' {
  switch (status) {
    case 'pending':
    case 'todo':
    case 'not_started':
      return 'todo';
    case 'in_progress':
      return 'in_progress';
    case 'client_review':
      return 'client_review';
    case 'completed':
    case 'done':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'todo';
  }
}

export type TaskAssignmentUpdate =
  | { kind: 'none' }
  | { kind: 'project'; id: string }
  | { kind: 'client'; id: string }
  | { kind: 'area'; id: string };

export type UpdateTaskInput = {
  title?: string;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  notes?: string | null;
  /** When set, replaces project/client/area linking (mutually exclusive). */
  assignment?: TaskAssignmentUpdate;
};

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.priority !== undefined) {
    updates.priority = normalizeTaskPriorityForDb(input.priority);
  }
  if (input.status !== undefined) updates.status = uiStatusToDb(input.status);
  if (input.dueDate !== undefined) updates.due_date = input.dueDate || null;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;

  if (input.assignment) {
    switch (input.assignment.kind) {
      case 'none':
        updates.project_id = null;
        updates.client_id = null;
        updates.area_id = null;
        break;
      case 'project':
        updates.project_id = input.assignment.id;
        updates.client_id = null;
        updates.area_id = null;
        break;
      case 'client':
        updates.client_id = input.assignment.id;
        updates.project_id = null;
        updates.area_id = null;
        break;
      case 'area':
        updates.area_id = input.assignment.id;
        updates.project_id = null;
        updates.client_id = null;
        break;
      default:
        break;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, error: null };
  }

  const { error } = await client
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) {
    const msg =
      error.message?.includes("'client_id'") &&
      error.message?.toLowerCase().includes('schema cache')
        ? "Tasks table is missing the client_id column. Run migrations (e.g. pnpm supabase:web:reset or supabase db push from apps/web) then pnpm --filter web supabase:typegen."
        : error.message;
    return { success: false, error: msg };
  }

  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true, error: null };
}

export async function deleteTask(taskId: string) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true, error: null };
}

export type TaskAssignmentOption = {
  id: string;
  name: string;
  type: 'project' | 'area' | 'client';
  color: string | null;
  /** Team account (workspace) for projects — same rows as `/app/[slug]`. */
  accountId?: string | null;
  accountName?: string | null;
};

type ProjectAssignmentRow = {
  id: string;
  name?: string | null;
  account_id?: string | null;
  accounts?: { id?: string; name?: string | null } | null;
  businesses?: { colour?: string | null } | null;
};

type AreaAssignmentRow = {
  id: string;
  name?: string | null;
  colour?: string | null;
};

type ClientAssignmentRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function clientAssignmentLabel(row: ClientAssignmentRow): string {
  const dn = row.display_name?.trim();
  if (dn) return dn;
  const parts = [row.first_name, row.last_name]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .map((x) => String(x).trim())
    .join(' ');
  return parts || 'Client';
}

/** Projects + CRM clients for one workspace — tasks list shows rows linked to either. */
export async function loadTaskAssignmentOptionsForWorkspace(
  accountId: string,
): Promise<TaskAssignmentOption[]> {
  const userClient = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const readDb = await getDbForWorkspaceTaskAssignmentOptions(
    userClient,
    user.id,
    accountId,
  );

  const [projectsResult, clientsResult] = await Promise.all([
    readDb
      .from('projects')
      .select('id, name, account_id, accounts(id, name), businesses(colour)')
      .eq('account_id', accountId)
      .not('status', 'in', '("completed","cancelled","archived")'),
    readDb
      .from('clients')
      .select('id, display_name, first_name, last_name, account_id')
      .eq('account_id', accountId),
  ]);

  const projects: TaskAssignmentOption[] = (projectsResult.data ?? []).map(
    (row: ProjectAssignmentRow) => ({
      id: row.id,
      name: row.name ?? 'Untitled project',
      type: 'project' as const,
      color: row.businesses?.colour ?? null,
      accountId: row.account_id ?? row.accounts?.id ?? null,
      accountName: row.accounts?.name?.trim() || null,
    }),
  );

  const clients: TaskAssignmentOption[] = (clientsResult.data ?? []).map(
    (row: ClientAssignmentRow) => ({
      id: row.id,
      name: clientAssignmentLabel(row),
      type: 'client' as const,
      color: null,
      accountId,
      accountName: null,
    }),
  );

  return [...projects, ...clients];
}

export async function loadTaskAssignmentOptions(): Promise<TaskAssignmentOption[]> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [projectsResult, areasResult] = await Promise.all([
    client
      .from('projects')
      .select('id, name, account_id, accounts(id, name), businesses(colour)')
      .not('status', 'in', '("completed","cancelled","archived")'),
    client
      .from('areas')
      .select('id, name, colour')
      .eq('user_id', user.id),
  ]);

  const projects: TaskAssignmentOption[] = (projectsResult.data ?? []).map(
    (row: ProjectAssignmentRow) => ({
      id: row.id,
      name: row.name ?? 'Untitled project',
      type: 'project' as const,
      color: row.businesses?.colour ?? null,
      accountId: row.account_id ?? row.accounts?.id ?? null,
      accountName: row.accounts?.name?.trim() || null,
    }),
  );

  const areas: TaskAssignmentOption[] = (areasResult.data ?? []).map(
    (row: AreaAssignmentRow) => ({
      id: row.id,
      name: row.name ?? 'Untitled area',
      type: 'area' as const,
      color: row.colour ?? null,
    }),
  );

  return [...projects, ...areas];
}

/** Load current user's tasks linked to this client (for client detail page). */
export async function getTasksForClient(
  clientId: string,
): Promise<TasksPageTask[]> {
  return loadTasksForClient(clientId);
}
