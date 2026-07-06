import { z } from 'zod';

import type { OzerMcpToolRegistrar } from './types';
import {
  assertAccountAccess,
  assertSupabaseOk,
  loadUserAccountIds,
  toolJson,
} from './shared';

const listProjectsSchema = z.object({
  business_id: z.string().uuid().optional(),
  status: z.string().trim().optional(),
});

const getProjectSchema = z.object({
  id: z.string().uuid(),
});

type ProjectRow = {
  id: string;
  name: string | null;
  status?: string | null;
  business_id?: string | null;
  area_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  account_id?: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  area_id: string | null;
};

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status ?? null,
    business_id: row.business_id ?? null,
    area_id: row.area_id ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
  };
}

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    project_id: row.project_id,
    area_id: row.area_id,
  };
}

const PROJECT_SELECT = 'id, name, status, business_id, account_id';

export const registerProjectTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_projects',
    {
      description:
        'List projects in workspaces the authenticated user belongs to.',
      inputSchema: listProjectsSchema,
    },
    async (input) => {
      const accountIds = await loadUserAccountIds(supabase, userId);
      if (accountIds.length === 0) {
        return toolJson({ projects: [] });
      }

      let query = supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .in('account_id', accountIds)
        .order('name', { ascending: true });

      if (input.business_id) {
        query = query.eq('business_id', input.business_id);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list projects');

      return toolJson({ projects: (data ?? []).map(mapProject) });
    },
  );

  server.registerTool(
    'get_project',
    {
      description:
        'Get a project by id with tasks owned by the authenticated user.',
      inputSchema: getProjectSchema,
    },
    async (input) => {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('id', input.id)
        .maybeSingle();

      assertSupabaseOk(project, projectError, 'get project');

      if (!project) {
        throw new Error('Project not found');
      }

      const accountId = (project as ProjectRow).account_id;
      if (!accountId) {
        throw new Error('Project not found');
      }

      await assertAccountAccess(supabase, userId, accountId);

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(
          'id, title, status, priority, due_date, project_id, area_id',
        )
        .eq('project_id', input.id)
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false });

      assertSupabaseOk(tasks, tasksError, 'load project tasks');

      return toolJson({
        project: mapProject(project as ProjectRow),
        tasks: (tasks ?? []).map(mapTask),
      });
    },
  );
};
