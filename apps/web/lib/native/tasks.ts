import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createRecorderTask } from '~/lib/recorder/create-task';

import { NativeHttpError } from './http';
import {
  type NativeTaskStatus,
  mapNativeTaskStatus,
  uiStatusToDb,
} from './task-status';
import type { NativeWorkspace } from './workspace-shared';

export { uiStatusToDb } from './task-status';

const TASK_LIST_LIMIT = 300;

const TASK_SELECT =
  'id, title, status, priority, due_date, account_id, user_id, assignee_contact_id';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type NativeTask = {
  id: string;
  title: string;
  status: NativeTaskStatus;
  due: string | null;
  workspace: string;
};

function parseDue(value: string | null | undefined) {
  if (value == null || value === '') return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new NativeHttpError(400, 'due must be YYYY-MM-DD');
  }
  return trimmed;
}

type TaskRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  account_id?: string | null;
  user_id?: string | null;
  assignee_contact_id?: string | null;
};

function toNativeTask(row: TaskRow, workspace: NativeWorkspace): NativeTask {
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled task',
    status: mapNativeTaskStatus(row.status),
    due: row.due_date?.trim() || null,
    workspace: workspace.slug,
  };
}

function isSignedInUserTask(row: TaskRow, userId: string) {
  return row.user_id === userId && !row.assignee_contact_id;
}

export async function listNativeTasks(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
  day?: string | null,
) {
  const dueDay = day ? parseDue(day) : null;

  let query = client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .eq('account_id', workspace.id)
    .is('assignee_contact_id', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(TASK_LIST_LIMIT);

  if (dueDay) {
    query = query.eq('due_date', dueDay);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as TaskRow[])
    .filter((row) => isSignedInUserTask(row, userId))
    .map((row) => toNativeTask(row, workspace));
}

export async function createNativeTask(input: {
  userId: string;
  workspace: NativeWorkspace;
  title: string;
  due?: string | null;
}) {
  const title = input.title.trim();
  if (!title) {
    throw new NativeHttpError(400, 'title is required');
  }

  const created = await createRecorderTask({
    userId: input.userId,
    accountId: input.workspace.id,
    title,
    dueDate: parseDue(input.due),
  });

  return {
    id: created.id,
    title,
    status: 'pending' as const,
    due: parseDue(input.due),
    workspace: input.workspace.slug,
  };
}

export async function updateNativeTask(input: {
  client: SupabaseClient;
  userId: string;
  taskId: string;
  status?: string;
  due?: string | null;
  title?: string;
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

  const row = existing as TaskRow;
  if (!isSignedInUserTask(row, input.userId)) {
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

  if (Object.keys(updates).length === 0) {
    throw new NativeHttpError(400, 'No task fields to update');
  }

  const { data, error } = await input.client
    .from('tasks')
    .update(updates)
    .eq('id', input.taskId)
    .eq('user_id', input.userId)
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Task not found');
  }

  const updated = data as TaskRow;
  let workspaceSlug = '';

  if (updated.account_id) {
    const { data: account } = await input.client
      .from('accounts')
      .select('slug')
      .eq('id', updated.account_id)
      .maybeSingle();
    workspaceSlug = account?.slug?.trim() || '';
  }

  return toNativeTask(updated, {
    id: updated.account_id ?? '',
    slug: workspaceSlug,
    name: workspaceSlug,
    profile: 'personal',
    isPersonal: false,
  });
}
