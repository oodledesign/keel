import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { createTask } from '~/home/(user)/_lib/actions/task-actions';

import {
  assertAccountMember,
  assertTasksModuleEnabled,
} from '../module-access';
import type { CreateTaskActionData } from '../types';

export async function executeCreateTask(
  client: SupabaseClient,
  userId: string,
  data: CreateTaskActionData,
): Promise<{ entityId: string; link: string; message: string }> {
  await assertAccountMember(client, userId, data.accountId);
  await assertTasksModuleEnabled(client, data.accountId);

  const result = await createTask({
    title: data.title,
    notes: data.notes,
    dueDate: data.dueDate ?? undefined,
    priority: data.priority,
    projectId: data.projectId ?? undefined,
    clientId: data.clientId ?? undefined,
  });

  if (!result.success || !result.id) {
    throw new Error(result.error ?? 'Failed to create task');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', data.accountId)
    .maybeSingle();

  const slug = (account as { slug?: string | null } | null)?.slug;
  const link = slug
    ? pathsConfig.app.accountTasks.replace('[account]', slug)
    : '/app/tasks';

  return {
    entityId: result.id,
    link,
    message: `Task "${data.title}" created`,
  };
}
