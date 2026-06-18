import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { assertTasksModuleEnabled } from '~/lib/quick-action/module-access';

const TASK_DB_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

function normalizeTaskPriority(input: string | undefined | null) {
  const raw = String(input ?? 'medium').trim().toLowerCase();
  if (TASK_DB_PRIORITIES.has(raw)) return raw;
  return 'medium';
}

async function assertProjectBelongsToAccount(
  admin: SupabaseClient,
  projectId: string,
  accountId: string,
) {
  const { data, error } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function assertClientBelongsToAccount(
  admin: SupabaseClient,
  clientId: string,
  accountId: string,
) {
  const { data, error } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  return !error && Boolean(data);
}

export type CreateRecorderTaskInput = {
  userId: string;
  accountId: string;
  title: string;
  priority?: string;
  dueDate?: string | null;
  notes?: string | null;
  projectId?: string | null;
  clientId?: string | null;
};

export async function createRecorderTask(input: CreateRecorderTaskInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Task title is required');
  }

  const admin = getSupabaseServerAdminClient();
  await assertWorkspaceMember(admin, input.accountId, input.userId);
  await assertTasksModuleEnabled(admin, input.accountId);

  let projectId = input.projectId?.trim() || null;
  let clientId = input.clientId?.trim() || null;

  if (projectId && clientId) {
    throw new Error('Link a task to either a project or a client, not both');
  }

  if (projectId && !(await assertProjectBelongsToAccount(admin, projectId, input.accountId))) {
    throw new Error('Invalid project for this workspace');
  }

  if (clientId && !(await assertClientBelongsToAccount(admin, clientId, input.accountId))) {
    throw new Error('Invalid client for this workspace');
  }

  const { data, error } = await admin
    .from('tasks')
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      title,
      priority: normalizeTaskPriority(input.priority),
      due_date: input.dueDate?.trim() || null,
      notes: input.notes?.trim() || null,
      project_id: projectId,
      client_id: clientId,
      status: 'todo',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create task');
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', input.accountId)
    .maybeSingle();

  const slug = (account as { slug?: string | null } | null)?.slug?.trim();
  const detailPath = slug
    ? workAccountPath(pathsConfig.app.accountTasks, slug)
    : undefined;

  return {
    id: data.id as string,
    account_id: input.accountId,
    detail_path: detailPath,
  };
}
