'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTaskForUser } from '@kit/tasks/create-task';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  loadTaskAssignmentOptions as loadTaskAssignmentOptionsCached,
  loadTaskAssignmentOptionsForWorkspace as loadTaskAssignmentOptionsForWorkspaceCached,
} from '../server/task-assignment-options.loader';
import type { TasksPageTask } from '../server/tasks.loader';
import { loadTaskById, loadTasksForClient } from '../server/tasks.loader';

const TASK_DB_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

/** Maps UI / AI labels to values allowed by `tasks_priority_check` in the database. */
function normalizeTaskPriorityForDb(input: string | undefined | null): string {
  const raw = String(input ?? 'medium')
    .trim()
    .toLowerCase();
  if (TASK_DB_PRIORITIES.has(raw)) return raw;
  if (raw === 'normal' || raw === 'default') return 'medium';
  return 'medium';
}

async function resolveTaskAccountId(
  client: ReturnType<typeof getSupabaseServerClient>,
  input: {
    projectId?: string | null;
    clientId?: string | null;
    jobId?: string | null;
    accountId?: string | null;
  },
): Promise<string | null> {
  if (input.accountId) {
    return input.accountId;
  }

  if (input.projectId) {
    const { data } = await client
      .from('projects')
      .select('account_id')
      .eq('id', input.projectId)
      .maybeSingle();
    return (data as { account_id?: string | null } | null)?.account_id ?? null;
  }

  if (input.clientId) {
    const { data } = await client
      .from('clients')
      .select('account_id')
      .eq('id', input.clientId)
      .maybeSingle();
    return (data as { account_id?: string | null } | null)?.account_id ?? null;
  }

  if (input.jobId) {
    const { data } = await client
      .from('projects')
      .select('account_id')
      .eq('id', input.jobId)
      .maybeSingle();
    return (data as { account_id?: string | null } | null)?.account_id ?? null;
  }

  return null;
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
  /** Skip parent re-fetch when the parent was just created in the same request. */
  parentTaskContext?: {
    projectId?: string | null;
    clientId?: string | null;
    areaId?: string | null;
    accountId?: string | null;
    jobId?: string | null;
  };
  notes?: string | null;
  /** Team workspace when creating from a business context without project/client. */
  accountId?: string;
};

export async function createTask(input: CreateTaskInput) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const result = await createTaskForUser(client, user.id, {
    title: input.title,
    priority: normalizeTaskPriorityForDb(input.priority) as
      | 'low'
      | 'medium'
      | 'high'
      | 'urgent',
    dueDate: input.dueDate,
    projectId: input.projectId,
    areaId: input.areaId,
    clientId: input.clientId,
    parentTaskId: input.parentTaskId,
    parentTaskContext: input.parentTaskContext,
    accountId: input.accountId,
    notes: input.notes,
  });

  if (!result.success) {
    return { success: false, error: result.error, id: null };
  }

  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true, error: null, id: result.id };
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
        updates.account_id = null;
        break;
      case 'project':
        updates.project_id = input.assignment.id;
        updates.client_id = null;
        updates.area_id = null;
        updates.account_id = await resolveTaskAccountId(client, {
          projectId: input.assignment.id,
        });
        break;
      case 'client':
        updates.client_id = input.assignment.id;
        updates.project_id = null;
        updates.area_id = null;
        updates.account_id = await resolveTaskAccountId(client, {
          clientId: input.assignment.id,
        });
        break;
      case 'area':
        updates.area_id = input.assignment.id;
        updates.project_id = null;
        updates.client_id = null;
        updates.account_id = null;
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
        ? 'Tasks table is missing the client_id column. Run migrations (e.g. pnpm supabase:web:reset or supabase db push from apps/web) then pnpm --filter web supabase:typegen.'
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

/** Projects + CRM clients for one workspace — tasks list shows rows linked to either. */
export async function loadTaskAssignmentOptionsForWorkspace(
  accountId: string,
): Promise<TaskAssignmentOption[]> {
  return loadTaskAssignmentOptionsForWorkspaceCached(accountId);
}

export async function loadTaskAssignmentOptions(): Promise<
  TaskAssignmentOption[]
> {
  return loadTaskAssignmentOptionsCached();
}

/** Load current user's tasks linked to this client (for client detail page). */
export async function getTasksForClient(
  clientId: string,
): Promise<TasksPageTask[]> {
  return loadTasksForClient(clientId);
}

/** Fetch one task for dashboard quick-open / edit dialog. */
export async function loadTaskForEdit(
  taskId: string,
  workspaceAccountId?: string,
): Promise<TasksPageTask | null> {
  return loadTaskById(taskId, { workspaceAccountId });
}
