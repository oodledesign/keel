import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

const TASK_STATUSES = new Set([
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
] as const);

const TASK_PRIORITIES = new Set([
  'low',
  'medium',
  'high',
  'urgent',
] as const);

export type TaskStatus = (typeof TASK_STATUSES extends Set<infer T> ? T : never);
export type TaskPriority = (typeof TASK_PRIORITIES extends Set<infer T>
  ? T
  : never);

export type CreateTaskInput = {
  title: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  notes?: string | null;
  dueDate?: string;
  projectId?: string;
  areaId?: string;
  clientId?: string;
  parentTaskId?: string;
  phaseId?: string;
  accountId?: string;
  groupId?: string;
  source?: string;
  /** When set, inherits project/client/area from parent if those are omitted. */
  parentTaskContext?: {
    projectId?: string | null;
    clientId?: string | null;
    areaId?: string | null;
    accountId?: string | null;
    jobId?: string | null;
  };
  jobId?: string;
};

export type CreateTaskResult =
  | { success: true; id: string; error: null }
  | { success: false; id: null; error: string };

function normalizeTaskPriority(
  input: string | undefined | null,
): TaskPriority {
  const raw = String(input ?? 'medium').trim().toLowerCase();
  if (TASK_PRIORITIES.has(raw as TaskPriority)) {
    return raw as TaskPriority;
  }
  if (raw === 'normal' || raw === 'default') {
    return 'medium';
  }
  return 'medium';
}

function normalizeTaskStatus(input: string | undefined | null): TaskStatus {
  const raw = String(input ?? 'todo').trim().toLowerCase();

  switch (raw) {
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
      if (TASK_STATUSES.has(raw as TaskStatus)) {
        return raw as TaskStatus;
      }
      return 'todo';
  }
}

async function resolveTaskAccountId(
  client: SupabaseClient<Database>,
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
      .from('jobs')
      .select('account_id')
      .eq('id', input.jobId)
      .maybeSingle();
    return (data as { account_id?: string | null } | null)?.account_id ?? null;
  }

  return null;
}

export async function createTaskForUser(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateTaskInput,
): Promise<CreateTaskResult> {
  const title = input.title?.trim();
  if (!title) {
    return { success: false, id: null, error: 'Title is required' };
  }

  const priority = normalizeTaskPriority(input.priority);
  const status = normalizeTaskStatus(input.status);

  let projectId = input.projectId || null;
  let clientId = input.clientId || null;
  let areaId = input.areaId || null;
  let accountId = input.accountId || null;

  if (input.parentTaskId) {
    if (input.parentTaskContext) {
      const parent = input.parentTaskContext;
      projectId = projectId ?? parent.projectId ?? null;
      clientId = clientId ?? parent.clientId ?? null;
      areaId = areaId ?? parent.areaId ?? null;
      accountId = accountId ?? parent.accountId ?? null;
      if (!accountId && parent.jobId) {
        accountId = await resolveTaskAccountId(client, { jobId: parent.jobId });
      }
    } else {
      const { data: parent, error: parentError } = await client
        .from('tasks')
        .select('user_id, project_id, client_id, area_id, account_id, job_id')
        .eq('id', input.parentTaskId)
        .maybeSingle();

      if (parentError || !parent) {
        return { success: false, id: null, error: 'Parent task not found' };
      }

      const row = parent as {
        project_id: string | null;
        client_id: string | null;
        area_id: string | null;
        account_id: string | null;
        job_id: string | null;
      };

      projectId = projectId ?? row.project_id;
      clientId = clientId ?? row.client_id;
      areaId = areaId ?? row.area_id;
      accountId = accountId ?? row.account_id;
      if (!accountId && row.job_id) {
        accountId = await resolveTaskAccountId(client, { jobId: row.job_id });
      }
    }
  }

  accountId =
    accountId ??
    (await resolveTaskAccountId(client, {
      projectId,
      clientId,
      jobId: input.jobId,
    }));

  const insertRow = {
    title,
    priority,
    status,
    due_date: input.dueDate || null,
    project_id: projectId,
    area_id: areaId,
    client_id: clientId,
    account_id: accountId,
    user_id: userId,
    ...(input.parentTaskId ? { parent_task_id: input.parentTaskId } : {}),
    ...(input.phaseId ? { phase_id: input.phaseId } : {}),
    ...(input.groupId ? { group_id: input.groupId } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };

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
    return { success: false, id: null, error: msg };
  }

  return { success: true, id: data.id as string, error: null };
}
