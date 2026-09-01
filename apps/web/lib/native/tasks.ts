import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createRecorderTask } from '~/lib/recorder/create-task';

import { NativeHttpError } from './http';
import {
  DONE_NATIVE_TASK_DB_STATUSES,
  type NativeTask,
  type NativeTaskClientRow,
  type NativeTaskRow,
  OPEN_NATIVE_TASK_DB_STATUSES,
  canSeeNativeTask,
  isPersonalNativeWorkspace,
  nativeClientName,
  nativeTaskTitleIlike,
  parseNativeTaskListStatus,
  parseNativeTaskSearch,
  parseOptionalClientId,
  toNativeTask,
} from './task-map';
import { uiStatusToDb } from './task-status';
import { loadNativeWorkspaces } from './workspace';
import type { NativeWorkspace } from './workspace-shared';

export { uiStatusToDb } from './task-status';
export {
  canSeeNativeTask,
  isPersonalNativeWorkspace,
  nativeTaskTitleIlike,
  parseNativeTaskListStatus,
  parseNativeTaskSearch,
  parseOptionalClientId,
  toNativeTask,
} from './task-map';
export type { NativeTask } from './task-map';

const TASK_LIST_LIMIT = 300;

const TASK_SELECT =
  'id, title, status, priority, due_date, account_id, user_id, assignee_contact_id, client_id';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDue(value: string | null | undefined) {
  if (value == null || value === '') return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new NativeHttpError(400, 'due must be YYYY-MM-DD');
  }
  return trimmed;
}

async function loadClientRows(
  client: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, NativeTaskClientRow>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .in('id', unique);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, NativeTaskClientRow>();
  for (const row of (data ?? []) as NativeTaskClientRow[]) {
    map.set(row.id, row);
  }
  return map;
}

async function mapTasksWithClients(
  client: SupabaseClient,
  rows: NativeTaskRow[],
  workspace: NativeWorkspace,
): Promise<NativeTask[]> {
  const names = await loadClientRows(
    client,
    rows.map((row) => row.client_id ?? '').filter(Boolean),
  );

  return rows.map((row) =>
    toNativeTask(
      row,
      workspace,
      nativeClientName(row.client_id ? names.get(row.client_id) : null),
    ),
  );
}

async function requireClientInWorkspace(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
): Promise<NativeTaskClientRow> {
  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }

  return data as NativeTaskClientRow;
}

async function workspaceForAccount(
  client: SupabaseClient,
  userId: string,
  accountId: string | null | undefined,
): Promise<NativeWorkspace | null> {
  if (!accountId) return null;
  const workspaces = await loadNativeWorkspaces(client, userId);
  return workspaces.find((workspace) => workspace.id === accountId) ?? null;
}

function recorderCreateError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : 'Failed to create task';
  if (/invalid client/i.test(message)) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }
  if (/title is required/i.test(message)) {
    throw new NativeHttpError(400, 'title is required');
  }
  throw error instanceof Error ? error : new Error(message);
}

export async function listNativeTasks(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
  options?: {
    day?: string | null;
    clientId?: string | null;
    status?: string | null;
    q?: string | null;
  },
) {
  const dueDay = options?.day ? parseDue(options.day) : null;
  const clientId = parseOptionalClientId(options?.clientId ?? undefined);
  const listStatus = parseNativeTaskListStatus(options?.status);
  const search = parseNativeTaskSearch(options?.q);

  let query = client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('account_id', workspace.id)
    .is('assignee_contact_id', null);

  if (listStatus === 'open') {
    query = query.in('status', [...OPEN_NATIVE_TASK_DB_STATUSES]);
  } else if (listStatus === 'done') {
    query = query.in('status', [...DONE_NATIVE_TASK_DB_STATUSES]);
  }

  query = query
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(TASK_LIST_LIMIT);

  if (isPersonalNativeWorkspace(workspace)) {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  if (dueDay) {
    query = query.eq('due_date', dueDay);
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (search) {
    query = query.ilike('title', nativeTaskTitleIlike(search));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const visible = ((data ?? []) as NativeTaskRow[]).filter((row) =>
    canSeeNativeTask(row, userId, workspace),
  );

  return mapTasksWithClients(client, visible, workspace);
}

export async function getNativeTask(input: {
  client: SupabaseClient;
  userId: string;
  taskId: string;
  workspace: NativeWorkspace;
}) {
  const { data, error } = await input.client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', input.taskId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const row = data as NativeTaskRow;
  if (!canSeeNativeTask(row, input.userId, input.workspace)) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const [mapped] = await mapTasksWithClients(
    input.client,
    [row],
    input.workspace,
  );
  return mapped;
}

export async function createNativeTask(input: {
  userId: string;
  workspace: NativeWorkspace;
  title: string;
  due?: string | null;
  clientId?: string | null;
  client: SupabaseClient;
}) {
  const title = input.title.trim();
  if (!title) {
    throw new NativeHttpError(400, 'title is required');
  }

  const due = parseDue(input.due);
  const clientId = parseOptionalClientId(input.clientId ?? undefined) ?? null;

  let clientRow: NativeTaskClientRow | null = null;
  if (clientId) {
    clientRow = await requireClientInWorkspace(
      input.client,
      clientId,
      input.workspace.id,
    );
  }

  let created: { id: string };
  try {
    created = await createRecorderTask({
      userId: input.userId,
      accountId: input.workspace.id,
      title,
      dueDate: due,
      clientId,
    });
  } catch (error) {
    recorderCreateError(error);
  }

  return toNativeTask(
    {
      id: created.id,
      title,
      status: 'todo',
      due_date: due,
      account_id: input.workspace.id,
      user_id: input.userId,
      client_id: clientId,
    },
    input.workspace,
    nativeClientName(clientRow),
  );
}

export async function updateNativeTask(input: {
  client: SupabaseClient;
  userId: string;
  taskId: string;
  status?: string;
  due?: string | null;
  title?: string;
  clientId?: string | null;
}) {
  const { data: existing, error: loadError } = await input.client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', input.taskId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!existing) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const row = existing as NativeTaskRow;
  const workspace = await workspaceForAccount(
    input.client,
    input.userId,
    row.account_id,
  );

  if (!workspace || !canSeeNativeTask(row, input.userId, workspace)) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new NativeHttpError(400, 'title is required');
    }
    updates.title = title;
  }
  if (input.status !== undefined) {
    updates.status = uiStatusToDb(input.status);
  }
  if (input.due !== undefined) {
    updates.due_date = parseDue(input.due);
  }
  if (input.clientId !== undefined) {
    const clientId = parseOptionalClientId(input.clientId);
    if (clientId) {
      await requireClientInWorkspace(input.client, clientId, workspace.id);
    }
    updates.client_id = clientId ?? null;
  }

  if (Object.keys(updates).length === 0) {
    throw new NativeHttpError(400, 'No task fields to update');
  }

  const { data, error } = await input.client
    .from('tasks')
    .update(updates)
    .eq('id', input.taskId)
    .eq('account_id', workspace.id)
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const [mapped] = await mapTasksWithClients(
    input.client,
    [data as NativeTaskRow],
    workspace,
  );
  return mapped;
}
