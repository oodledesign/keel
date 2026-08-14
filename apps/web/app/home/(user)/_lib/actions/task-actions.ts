'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTaskForUser } from '@kit/tasks/create-task';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { loadTaskPersonAssigneeOptions } from '~/lib/tasks/task-person-assignee.server';
import type { TaskPersonAssigneeOption } from '~/lib/tasks/task-person-assignee';

import {
  loadPersonalLifeAssignmentOptions as loadPersonalLifeAssignmentOptionsCached,
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
  /** Team member assignee (defaults to current user). */
  assigneeUserId?: string | null;
  /** CRM contact responsible (portal My tasks). */
  assigneeContactId?: string | null;
  /** When set, creates a recurring series (and usually the first task). */
  recurrence?: {
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
    firstCreateDate: string;
    dayOfMonth?: number | null;
    dueDays?: number;
    endAt?: string | null;
    maxOccurrences?: number | null;
    /** Default true. Set false when scheduling future occurrences from an existing task. */
    createFirstNow?: boolean;
  };
};

export async function createTask(input: CreateTaskInput) {
  if (input.recurrence) {
    try {
      const { createTaskRecurringSeries } =
        await import('../server/task-recurring.server');
      const result = await createTaskRecurringSeries({
        title: input.title,
        priority: normalizeTaskPriorityForDb(input.priority),
        notes: input.notes,
        projectId: input.projectId,
        areaId: input.areaId,
        clientId: input.clientId,
        accountId: input.accountId,
        frequency: input.recurrence.frequency,
        firstCreateDate: input.recurrence.firstCreateDate,
        dayOfMonth: input.recurrence.dayOfMonth,
        dueDays: input.recurrence.dueDays,
        endAt: input.recurrence.endAt,
        maxOccurrences: input.recurrence.maxOccurrences,
        createFirstNow: input.recurrence.createFirstNow ?? true,
      });

      revalidatePath('/home', 'layout');
      revalidatePath('/home/tasks');
      revalidatePath('/app/tasks');
      return { success: true, error: null, id: result.taskId };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create recurring task',
        id: null,
      };
    }
  }

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
    assigneeUserId: input.assigneeUserId,
    assigneeContactId: input.assigneeContactId,
  });

  if (!result.success) {
    return { success: false, error: result.error, id: null };
  }

  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true, error: null, id: result.id };
}

export async function updateTaskRecurringSeriesStatusAction(input: {
  seriesId: string;
  status: 'active' | 'paused' | 'ended';
}) {
  const { updateTaskRecurringSeriesStatus } =
    await import('../server/task-recurring.server');
  await updateTaskRecurringSeriesStatus(input);
  revalidatePath('/home', 'layout');
  revalidatePath('/home/tasks');
  revalidatePath('/app/tasks');
  return { success: true as const };
}

export async function updateTaskRecurringSeriesAction(input: {
  seriesId: string;
  title: string;
  priority: string;
  notes?: string | null;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  nextCreateDate: string;
  dayOfMonth?: number | null;
  dueDays?: number;
  status?: 'active' | 'paused' | 'ended';
  assignment?: TaskAssignmentUpdate;
}) {
  try {
    const client = getSupabaseServerClient();
    let projectId: string | null | undefined;
    let clientId: string | null | undefined;
    let areaId: string | null | undefined;
    let accountId: string | null | undefined;

    if (input.assignment) {
      switch (input.assignment.kind) {
        case 'none':
          projectId = null;
          clientId = null;
          areaId = null;
          accountId = null;
          break;
        case 'project':
          projectId = input.assignment.id;
          clientId = null;
          areaId = null;
          accountId = await resolveTaskAccountId(client, {
            projectId: input.assignment.id,
          });
          break;
        case 'client':
          clientId = input.assignment.id;
          projectId = null;
          areaId = null;
          accountId = await resolveTaskAccountId(client, {
            clientId: input.assignment.id,
          });
          break;
        case 'area':
          areaId = input.assignment.id;
          projectId = null;
          clientId = null;
          accountId = null;
          break;
      }
    }

    const { updateTaskRecurringSeries } =
      await import('../server/task-recurring.server');
    const series = await updateTaskRecurringSeries({
      seriesId: input.seriesId,
      title: input.title,
      priority: normalizeTaskPriorityForDb(input.priority),
      notes: input.notes,
      frequency: input.frequency,
      nextCreateDate: input.nextCreateDate,
      dayOfMonth: input.dayOfMonth,
      dueDays: input.dueDays,
      status: input.status,
      projectId,
      clientId,
      areaId,
      accountId,
    });

    revalidatePath('/home', 'layout');
    revalidatePath('/home/tasks');
    revalidatePath('/app/tasks');
    return { success: true as const, error: null, series };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update series',
      series: null,
    };
  }
}

export async function listTaskRecurringSeriesAction() {
  const { listTaskRecurringSeriesForUser } =
    await import('../server/task-recurring.server');
  return listTaskRecurringSeriesForUser();
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
  /** Attached workspace notes `[{ id, title }]`. */
  noteRefs?: Array<{ id: string; title: string }>;
  /** When set, replaces project/client/area linking (mutually exclusive). */
  assignment?: TaskAssignmentUpdate;
  /** Team member assignee (`tasks.user_id`). Pass null to clear back to current user. */
  assigneeUserId?: string | null;
  /** CRM contact assignee. Pass null to clear. */
  assigneeContactId?: string | null;
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
  if (input.noteRefs !== undefined) {
    const uniqueIds = [...new Set(input.noteRefs.map((ref) => ref.id))];
    if (uniqueIds.length === 0) {
      updates.note_refs = [];
    } else {
      const { data: noteRows, error: notesErr } = await client
        .from('notes')
        .select('id, title, content')
        .in('id', uniqueIds);

      if (notesErr) {
        return { success: false, error: notesErr.message };
      }

      const found = new Map(
        (noteRows ?? []).map((row) => [
          row.id as string,
          {
            id: row.id as string,
            title: ((row.title as string | null)?.trim() ||
              ((row.content as string | null) ?? '').trim().slice(0, 80) ||
              'Untitled note') as string,
          },
        ]),
      );

      if (found.size !== uniqueIds.length) {
        return {
          success: false,
          error: 'One or more notes could not be attached',
        };
      }

      updates.note_refs = uniqueIds.map((id) => found.get(id)!);
    }
  }

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

  if (input.assigneeContactId !== undefined || input.assigneeUserId !== undefined) {
    const contactId = input.assigneeContactId?.trim() || null;
    if (contactId) {
      // Contact is responsible; keep an internal owner on user_id.
      updates.assignee_contact_id = contactId;
      updates.user_id = user.id;
    } else if (input.assigneeUserId !== undefined) {
      const memberId = input.assigneeUserId?.trim() || null;
      updates.assignee_contact_id = null;
      updates.user_id = memberId || user.id;
    } else {
      updates.assignee_contact_id = null;
      updates.user_id = user.id;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, error: null };
  }

  // RLS enforces access (owner + workspace membership). Do not filter by
  // user_id — tasks may be assigned to another member.
  // assignee_contact_id may lag generated Database types until typegen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('tasks') as any)
    .update(updates)
    .eq('id', taskId);

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

/** Life areas only — Personal create-task flow. */
export async function loadPersonalLifeAssignmentOptions(): Promise<
  TaskAssignmentOption[]
> {
  return loadPersonalLifeAssignmentOptionsCached();
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

/** Team members + CRM contacts for the person-assignee picker on a task. */
export async function loadTaskPersonAssigneesAction(input: {
  accountId: string;
  clientId?: string | null;
}): Promise<TaskPersonAssigneeOption[]> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', input.accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return [];
  }

  return loadTaskPersonAssigneeOptions(
    getSupabaseServerAdminClient(),
    input.accountId,
    { clientId: input.clientId ?? null },
  );
}
