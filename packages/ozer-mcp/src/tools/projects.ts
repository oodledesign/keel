import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type ClientNameRow,
  clientDisplayName,
  filterNamedByQuery,
  loadLinkedNames,
  loadSearchableProjects,
  projectDisplayName,
} from './lookup';
import {
  OPEN_TASK_STATUSES,
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const projectStatusSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_]{0,47}$/)
  .describe(
    'Workspace project status slug (e.g. pending, in_progress, invoiced). Use a status defined for the workspace.',
  );

const listProjectsSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace id. Omit to list projects across authorized workspaces.',
    ),
  business_id: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Only pass when the user names a specific client.'),
});

const getProjectSchema = z.object({
  id: z.string().uuid(),
});

const searchProjectsSchema = z.object({
  q: z.string().trim().min(1).max(200).describe('Project name search.'),
  account_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  account_id: z.string().uuid().describe('Workspace to create the project in.'),
  client_id: z.string().uuid().optional(),
  status: projectStatusSchema.optional(),
  description: z.string().optional(),
  start_date: z.string().trim().optional(),
  due_date: z.string().trim().optional(),
});

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  status: projectStatusSchema.optional(),
  description: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  start_date: z.string().trim().nullable().optional(),
  due_date: z.string().trim().nullable().optional(),
});

type ProjectRow = {
  id: string;
  name: string | null;
  title?: string | null;
  status?: string | null;
  description?: string | null;
  business_id?: string | null;
  client_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  end_date?: string | null;
  account_id?: string | null;
  project_type?: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  client_id?: string | null;
  account_id?: string | null;
};

const PROJECT_SELECT =
  'id, name, title, status, description, business_id, account_id, client_id, start_date, due_date, project_type';

function mapProject(
  row: ProjectRow,
  extras?: {
    client_name?: string | null;
    workspace_name?: string | null;
    workspace_slug?: string | null;
  },
) {
  return {
    id: row.id,
    name: projectDisplayName(row),
    status: row.status ?? null,
    description: row.description ?? null,
    business_id: row.business_id ?? null,
    client_id: row.client_id ?? null,
    client_name: extras?.client_name ?? null,
    start_date: row.start_date ?? null,
    due_date: row.due_date ?? row.end_date ?? null,
    account_id: row.account_id ?? null,
    workspace_name: extras?.workspace_name ?? null,
    workspace_slug: extras?.workspace_slug ?? null,
    project_type: row.project_type ?? null,
  };
}

async function enrichProjects(
  supabase: SupabaseClient,
  rows: ProjectRow[],
  workspaces: Awaited<ReturnType<typeof loadUserWorkspaces>>,
) {
  const extras = await loadLinkedNames(
    supabase,
    rows.map((row) => ({
      id: row.id,
      project_id: row.id,
      client_id: row.client_id,
      account_id: row.account_id,
    })),
    workspaces,
  );

  return rows.map((row) =>
    mapProject(row, {
      client_name: extras.get(row.id)?.client_name ?? null,
      workspace_name: extras.get(row.id)?.workspace_name ?? null,
      workspace_slug: extras.get(row.id)?.workspace_slug ?? null,
    }),
  );
}

async function loadProjectRow(
  supabase: SupabaseClient,
  id: string,
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .maybeSingle();

  assertSupabaseOk(data, error, 'get project');

  if (!data) {
    throw new Error('Project not found');
  }

  return data as ProjectRow;
}

async function assertClientInWorkspace(
  supabase: SupabaseClient,
  clientId: string,
  accountId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'resolve client');

  if (!data) {
    throw new Error('Client not found in this workspace');
  }
}

export const registerProjectTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_projects',
    {
      description:
        'List projects in workspaces the authenticated user belongs to. Do not pick a project just to list tasks — list_tasks already returns outstanding work across all clients and projects. Use search_projects to find one by name.',
      inputSchema: listProjectsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

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
      if (input.client_id) {
        query = query.eq('client_id', input.client_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list projects');

      return toolJson({
        projects: await enrichProjects(
          supabase,
          (data ?? []) as ProjectRow[],
          workspaces,
        ),
      });
    },
  );

  server.registerTool(
    'search_projects',
    {
      description:
        'Fuzzy-search delivery projects by name across authorized workspaces. Returns id, name, client, and workspace. Use this before create_task or extract_tasks when the user names a project. Do not search just to list current tasks.',
      inputSchema: searchProjectsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ projects: [] });
      }

      const matches = filterNamedByQuery(
        await loadSearchableProjects(supabase, accountIds),
        input.q,
        input.limit,
      );

      const clientIds = [
        ...new Set(
          matches
            .map((row) => row.row.client_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const { data: clientRows, error: clientsError } =
        clientIds.length > 0
          ? await supabase
              .from('clients')
              .select(
                'id, display_name, first_name, last_name, company_name, account_id',
              )
              .in('id', clientIds)
          : { data: [], error: null };

      assertSupabaseOk(clientRows, clientsError, 'load project clients');

      const clientsById = new Map(
        ((clientRows ?? []) as ClientNameRow[]).map((row) => [row.id, row]),
      );
      const workspacesById = new Map(
        workspaces.map((workspace) => [workspace.id, workspace]),
      );

      return toolJson({
        projects: matches.map((match) => {
          const workspace = match.account_id
            ? workspacesById.get(match.account_id)
            : undefined;
          const client = match.row.client_id
            ? clientsById.get(match.row.client_id)
            : undefined;

          return {
            id: match.id,
            name: match.name,
            status: match.row.status ?? null,
            client_id: match.row.client_id ?? null,
            client_name: clientDisplayName(client ?? null),
            account_id: match.account_id,
            workspace_name: workspace?.name ?? null,
            workspace_slug: workspace?.slug ?? null,
          };
        }),
      });
    },
  );

  server.registerTool(
    'get_project',
    {
      description:
        'Get a project by id with outstanding tasks and client/workspace names.',
      inputSchema: getProjectSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const project = await loadProjectRow(supabase, input.id);
      const accountId = project.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Project not found');
      }

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(
          'id, title, status, priority, due_date, project_id, client_id, account_id',
        )
        .eq('project_id', input.id)
        .in('status', [...OPEN_TASK_STATUSES])
        .order('due_date', { ascending: true, nullsFirst: false });

      assertSupabaseOk(tasks, tasksError, 'load project tasks');

      const [mapped] = await enrichProjects(supabase, [project], workspaces);

      return toolJson({
        project: mapped,
        tasks: (tasks ?? []) as TaskRow[],
      });
    },
  );

  server.registerTool(
    'create_project',
    {
      description:
        'Create a delivery project in a workspace (account_id required). Optional client_id, status, description, start_date, due_date. Does not delete anything. Use search_clients if the user named a client.',
      inputSchema: createProjectSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      if (!workspaces.some((workspace) => workspace.id === input.account_id)) {
        throw new Error('Access denied for this workspace');
      }

      if (input.client_id) {
        await assertClientInWorkspace(
          supabase,
          input.client_id,
          input.account_id,
        );
      }

      const insertRow = {
        account_id: input.account_id,
        client_id: input.client_id ?? null,
        project_type: 'delivery',
        name: input.name,
        title: input.name,
        description: input.description ?? null,
        status: input.status ?? null,
        start_date: input.start_date ?? null,
        due_date: input.due_date ?? null,
        created_by: userId,
      };

      let result = await supabase
        .from('projects')
        .insert(insertRow)
        .select(PROJECT_SELECT)
        .single();

      if (result.error?.message?.includes('project_type')) {
        const { project_type: _projectType, ...withoutType } = insertRow;
        result = await supabase
          .from('projects')
          .insert(withoutType)
          .select(PROJECT_SELECT)
          .single();
      }

      assertSupabaseOk(result.data, result.error, 'create project');

      const [mapped] = await enrichProjects(
        supabase,
        [result.data as ProjectRow],
        workspaces,
      );

      return toolJson({ project: mapped });
    },
  );

  server.registerTool(
    'update_project',
    {
      description:
        'Patch a project the user can access: name, status, dates, description, or client_id. Only provided fields change. Cannot delete a project.',
      inputSchema: updateProjectSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const existing = await loadProjectRow(supabase, input.id);
      const accountId = existing.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Project not found');
      }

      if (input.client_id) {
        await assertClientInWorkspace(supabase, input.client_id, accountId);
      }

      const updates: Record<string, unknown> = pickDefined({
        status: input.status,
        description: input.description,
        client_id: input.client_id,
        start_date: input.start_date,
        due_date: input.due_date,
        ...(input.name ? { name: input.name, title: input.name } : {}),
      });

      if (Object.keys(updates).length === 0) {
        throw new Error('Provide at least one field to update');
      }

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', input.id)
        .eq('account_id', accountId)
        .select(PROJECT_SELECT)
        .maybeSingle();

      assertSupabaseOk(data, error, 'update project');

      if (!data) {
        throw new Error('Project not found');
      }

      const [mapped] = await enrichProjects(
        supabase,
        [data as ProjectRow],
        workspaces,
      );

      return toolJson({ project: mapped });
    },
  );
};
