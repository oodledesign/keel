import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type TasksPageTask = {
  id: string;
  title: string;
  projectName: string | null;
  areaLabel: string | null;
  context: 'work' | 'life';
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDateLabel: string;
  dueDate: string | null; // ISO date for edit form
  accentColor: string | null;
  clientId: string | null;
  clientName: string | null;
};

function mapTaskStatus(status: string | null | undefined): 'pending' | 'in_progress' | 'completed' {
  switch ((status ?? '').toLowerCase()) {
    case 'todo':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'done':
    case 'cancelled':
      return 'completed';
    default:
      return 'pending';
  }
}

function formatDueDateLabel(due: string | null): string {
  if (!due) return '';
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export const loadTasksForUser = cache(async (): Promise<TasksPageTask[]> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  // Minimal select first (no joins) so tasks show even if projects/areas/clients have RLS or missing tables.
  // If your Cloud DB uses a different owner column (e.g. owner_id), add .eq('owner_id', user.id) and ensure insert sets it.
  const { data, error } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, client_id')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsLast: true });

  if (error) {
    console.error('[tasks.loader] loadTasksForUser error:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const isWork = !!row.project_id;
    const context: 'work' | 'life' = isWork ? 'work' : 'life';
    const dueDateRaw = row.due_date ?? null;
    return {
      id: row.id as string,
      title: (row.title as string) ?? 'Untitled',
      projectName: null,
      areaLabel: null,
      context,
      status: mapTaskStatus(row.status),
      priority: (row.priority as TasksPageTask['priority']) ?? 'medium',
      dueDateLabel: formatDueDateLabel(dueDateRaw),
      dueDate: dueDateRaw ? String(dueDateRaw).slice(0, 10) : null,
      accentColor: null,
      clientId: row.client_id ?? null,
      clientName: null,
    };
  });
});

/** Tasks for a specific client (current user's tasks linked to this client). */
export const loadTasksForClient = cache(
  async (clientId: string): Promise<TasksPageTask[]> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { data, error } = await client
      .from('tasks')
      .select('id, title, status, priority, due_date, project_id, client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .order('due_date', { ascending: true, nullsLast: true });

    if (error) {
      console.error('[tasks.loader] loadTasksForClient error:', error.message);
      return [];
    }

    return (data ?? []).map((row: any) => {
      const isWork = !!row.project_id;
      const context: 'work' | 'life' = isWork ? 'work' : 'life';
      const dueDateRaw = row.due_date ?? null;
      return {
        id: row.id as string,
        title: (row.title as string) ?? 'Untitled',
        projectName: null,
        areaLabel: null,
        context,
        status: mapTaskStatus(row.status),
        priority: (row.priority as TasksPageTask['priority']) ?? 'medium',
        dueDateLabel: formatDueDateLabel(dueDateRaw),
        dueDate: dueDateRaw ? String(dueDateRaw).slice(0, 10) : null,
        accentColor: null,
        clientId: row.client_id ?? null,
        clientName: null,
      };
    });
  },
);

