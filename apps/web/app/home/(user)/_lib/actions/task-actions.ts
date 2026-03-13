'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import type { TasksPageTask } from '../server/tasks.loader';
import { loadTasksForClient } from '../server/tasks.loader';

export type CreateTaskInput = {
  title: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  areaId?: string;
  clientId?: string;
};

export async function createTask(input: CreateTaskInput) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('tasks')
    .insert({
      title: input.title,
      priority: input.priority,
      due_date: input.dueDate || null,
      project_id: input.projectId || null,
      area_id: input.areaId || null,
      client_id: input.clientId || null,
      user_id: user.id,
      // DB constraint allows: 'todo', 'in_progress', 'done', 'cancelled'
      status: 'todo',
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message, id: null };
  }

  revalidatePath('/home');
  revalidatePath('/home/tasks');
  return { success: true, error: null, id: data.id as string };
}

function uiStatusToDb(status: string): 'todo' | 'in_progress' | 'done' | 'cancelled' {
  switch (status) {
    case 'pending':
      return 'todo';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'done';
    default:
      return 'todo';
  }
}

export type UpdateTaskInput = {
  title?: string;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  clientId?: string | null;
};

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const client = getSupabaseServerClient();

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.status !== undefined) updates.status = uiStatusToDb(input.status);
  if (input.dueDate !== undefined) updates.due_date = input.dueDate || null;
  if (input.clientId !== undefined) updates.client_id = input.clientId || null;

  if (Object.keys(updates).length === 0) {
    return { success: true, error: null };
  }

  const { error } = await client.from('tasks').update(updates).eq('id', taskId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/home');
  revalidatePath('/home/tasks');
  return { success: true, error: null };
}

export type TaskAssignmentOption = {
  id: string;
  name: string;
  type: 'project' | 'area';
  color: string | null;
};

export async function loadTaskAssignmentOptions(): Promise<TaskAssignmentOption[]> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [projectsResult, areasResult] = await Promise.all([
    client
      .from('projects')
      .select('id, name, businesses(colour)')
      .not('status', 'in', '("completed","cancelled","archived")'),
    client
      .from('areas')
      .select('id, name, colour')
      .eq('user_id', user.id),
  ]);

  const projects: TaskAssignmentOption[] = (projectsResult.data ?? []).map(
    (row: any) => ({
      id: row.id,
      name: row.name ?? 'Untitled project',
      type: 'project' as const,
      color: row.businesses?.colour ?? null,
    }),
  );

  const areas: TaskAssignmentOption[] = (areasResult.data ?? []).map(
    (row: any) => ({
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
