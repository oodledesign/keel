import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { WorkspaceProfile } from '../workspace-profile';
import type { LinkOption } from './types';

export type WorkspaceLinkOptions = {
  projects: LinkOption[];
  jobs: LinkOption[];
  clients: LinkOption[];
  properties: LinkOption[];
  tasks: LinkOption[];
};

export async function loadWorkspaceLinkOptions(
  accountId: string,
  profile: WorkspaceProfile,
): Promise<WorkspaceLinkOptions> {
  const client = getSupabaseServerClient();
  const empty: WorkspaceLinkOptions = {
    projects: [],
    jobs: [],
    clients: [],
    properties: [],
    tasks: [],
  };

  const loadProjects = client
    .from('projects')
    .select('id, name')
    .eq('account_id', accountId)
    .order('name')
    .limit(200);

  const loadDeliveryProjects = client
    .from('projects')
    .select('id, name')
    .eq('account_id', accountId)
    .eq('project_type', 'delivery')
    .order('name')
    .limit(200);

  const loadClients = client
    .from('clients')
    .select('id, display_name, first_name, last_name, company_name')
    .eq('account_id', accountId)
    .order('display_name')
    .limit(200);

  const loadProperties = client
    .from('properties')
    .select('id, name')
    .eq('account_id', accountId)
    .order('name')
    .limit(200);

  const loadTasks = client
    .from('tasks')
    .select('id, title')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (profile === 'work_design') {
    const [projectsRes, deliveryProjectsRes, clientsRes, tasksRes] =
      await Promise.all([
      loadProjects,
      loadDeliveryProjects,
      loadClients,
      loadTasks,
    ]);

    return {
      projects: (projectsRes.data ?? []).map((p) => ({
        type: 'project' as const,
        id: p.id as string,
        label: (p.name as string) || 'Project',
      })),
      jobs: (deliveryProjectsRes.data ?? []).map((j) => ({
        type: 'job' as const,
        id: j.id as string,
        label: (j.name as string) || 'Project',
      })),
      clients: (clientsRes.data ?? []).map((c) => ({
        type: 'client' as const,
        id: c.id as string,
        label:
          (c.display_name as string | null)?.trim() ||
          [(c.first_name as string), (c.last_name as string)]
            .filter(Boolean)
            .join(' ') ||
          (c.company_name as string | null)?.trim() ||
          'Client',
      })),
      properties: [],
      tasks: (tasksRes.data ?? []).map((t) => ({
        type: 'task' as const,
        id: t.id as string,
        label: (t.title as string) || 'Task',
      })),
    };
  }

  if (profile === 'work_property') {
    const [propertiesRes, tasksRes] = await Promise.all([
      loadProperties,
      loadTasks,
    ]);
    return {
      ...empty,
      properties: (propertiesRes.data ?? []).map((p) => ({
        type: 'property' as const,
        id: p.id as string,
        label: (p.name as string) || 'Property',
      })),
      tasks: (tasksRes.data ?? []).map((t) => ({
        type: 'task' as const,
        id: t.id as string,
        label: (t.title as string) || 'Task',
      })),
    };
  }

  const tasksRes = await loadTasks;
  return {
    ...empty,
    tasks: (tasksRes.data ?? []).map((t) => ({
      type: 'task' as const,
      id: t.id as string,
      label: (t.title as string) || 'Task',
    })),
  };
}

/** Link-to choices for create forms by workspace profile. */
export function linkOptionsForProfile(
  options: WorkspaceLinkOptions,
  profile: WorkspaceProfile,
): LinkOption[] {
  if (profile === 'work_design') {
    return [
      ...options.projects,
      ...options.jobs,
      ...options.clients,
      ...options.tasks,
    ];
  }
  if (profile === 'work_property') {
    return [...options.properties, ...options.tasks];
  }
  return options.tasks;
}
