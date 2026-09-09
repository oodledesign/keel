import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { createTaskForUser } from '@kit/tasks/create-task';

import {
  type McpWorkspace,
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import {
  buildTaskListHint,
  ilikeContains,
  listTasksSchema,
  resolveTaskListStatuses,
  shouldRestrictToRootTasks,
  sortTaskRows,
} from './task-list';
import type { OzerMcpToolRegistrar } from './types';

const taskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
]);
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

const durationMinutesCreateSchema = z
  .number()
  .int()
  .positive()
  .max(10080)
  .optional();
const durationMinutesUpdateSchema = z
  .number()
  .int()
  .positive()
  .max(10080)
  .nullable()
  .optional();

const getTaskSchema = z.object({
  id: z.string().uuid(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  status: taskStatusSchema.optional().default('todo'),
  priority: taskPrioritySchema.optional().default('medium'),
  due_date: z.string().trim().optional(),
  duration_minutes: durationMinutesCreateSchema,
  project_id: z.string().uuid().optional(),
  area_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  due_date: z.string().trim().nullable().optional(),
  duration_minutes: durationMinutesUpdateSchema,
  project_id: z.string().uuid().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const listSubtasksSchema = z.object({
  parent_task_id: z.string().uuid(),
});

const createSubtaskSchema = z.object({
  parent_task_id: z.string().uuid(),
  title: z.string().trim().min(1),
  status: taskStatusSchema.optional().default('todo'),
  priority: taskPrioritySchema.optional().default('medium'),
  due_date: z.string().trim().optional(),
  duration_minutes: durationMinutesCreateSchema,
  notes: z.string().optional(),
});

const TASK_LIST_SELECT =
  'id, title, status, priority, due_date, duration_minutes, updated_at, project_id, client_id, area_id, account_id, parent_task_id';
const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, notes, user_id`;

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  duration_minutes: number | null;
  updated_at?: string | null;
  project_id: string | null;
  client_id?: string | null;
  area_id: string | null;
  parent_task_id?: string | null;
  notes?: string | null;
  account_id?: string | null;
  user_id?: string | null;
};

type TaskListExtras = {
  project_name?: string | null;
  client_name?: string | null;
  area_name?: string | null;
  workspace_name?: string | null;
  workspace_slug?: string | null;
};

function mapTask(row: TaskRow, extras?: TaskListExtras) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    duration_minutes: row.duration_minutes,
    updated_at: row.updated_at ?? null,
    project_id: row.project_id,
    project_name: extras?.project_name ?? null,
    client_id: row.client_id ?? null,
    client_name: extras?.client_name ?? null,
    area_id: row.area_id,
    account_id: row.account_id ?? null,
    workspace_name: extras?.workspace_name ?? null,
    workspace_slug: extras?.workspace_slug ?? null,
    parent_task_id: row.parent_task_id ?? null,
  };
}

function mapTaskDetail(row: TaskRow, extras?: TaskListExtras) {
  return {
    ...mapTask(row, extras),
    notes: row.notes ?? null,
    area_name: extras?.area_name ?? null,
  };
}

function mapSubtask(row: TaskRow) {
  return {
    ...mapTask(row),
    notes: row.notes ?? null,
  };
}

function summarizeSubtasks(rows: TaskRow[]) {
  const openStatuses = new Set(['todo', 'in_progress', 'client_review']);
  const done_count = rows.filter((row) => row.status === 'done').length;
  const open_count = rows.filter((row) =>
    openStatuses.has(row.status ?? ''),
  ).length;

  return {
    count: rows.length,
    done_count,
    open_count,
  };
}

function buildTaskUpdates(input: {
  title?: string;
  status?: z.infer<typeof taskStatusSchema>;
  priority?: z.infer<typeof taskPrioritySchema>;
  due_date?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  project_id?: string | null;
  area_id?: string | null;
}) {
  return pickDefined({
    title: input.title,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date,
    duration_minutes: input.duration_minutes,
    project_id: input.project_id,
    area_id: input.area_id,
    notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
  });
}

async function loadTaskRow(
  supabase: SupabaseClient,
  id: string,
  operation = 'get task',
): Promise<TaskRow> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  assertSupabaseOk(data, error, operation);

  if (!data) {
    throw new Error('Task not found');
  }

  return data as TaskRow;
}

async function loadChildTasks(
  supabase: SupabaseClient,
  parentTaskId: string,
): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_DETAIL_SELECT)
    .eq('parent_task_id', parentTaskId)
    .order('due_date', { ascending: true, nullsFirst: false });

  assertSupabaseOk(data, error, 'list subtasks');
  return (data ?? []) as TaskRow[];
}

type ProjectNameRow = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type ClientNameRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

function projectDisplayName(project: ProjectNameRow | null): string | null {
  return project?.name?.trim() || project?.title?.trim() || null;
}

function clientDisplayName(client: ClientNameRow | null): string | null {
  const displayName = client?.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [client?.first_name, client?.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .join(' ');

  return fullName || client?.company_name?.trim() || null;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

async function loadAssignmentNames(
  supabase: SupabaseClient,
  row: TaskRow,
  workspaces?: McpWorkspace[],
): Promise<TaskListExtras> {
  const [extras, areaResult] = await Promise.all([
    enrichTaskListRows(supabase, [row], workspaces),
    row.area_id
      ? supabase
          .from('areas')
          .select('id, name')
          .eq('id', row.area_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (areaResult.error) {
    console.warn(
      '[ozer-mcp] could not load area name:',
      areaResult.error.message,
    );
  }

  return {
    ...(extras.get(row.id) ?? {}),
    area_name:
      (areaResult.data as { name?: string | null } | null)?.name?.trim() ||
      null,
  };
}

async function enrichTaskListRows(
  supabase: SupabaseClient,
  rows: TaskRow[],
  workspaces: McpWorkspace[] = [],
): Promise<Map<string, TaskListExtras>> {
  const extras = new Map<string, TaskListExtras>();
  const workspacesById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  );

  const projectIds = uniqueIds(rows.map((row) => row.project_id));
  const clientIds = uniqueIds(rows.map((row) => row.client_id));
  const accountIds = uniqueIds(
    rows
      .map((row) => row.account_id)
      .filter((id) => id && !workspacesById.has(id)),
  );

  const [projectsResult, clientsResult, accountsResult] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, name, title').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase
          .from('clients')
          .select('id, display_name, first_name, last_name, company_name')
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length > 0
      ? supabase
          .from('accounts')
          .select('id, name, slug, space_type, is_personal_account')
          .in('id', accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (projectsResult.error) {
    console.warn(
      '[ozer-mcp] could not load project names:',
      projectsResult.error.message,
    );
  }
  if (clientsResult.error) {
    console.warn(
      '[ozer-mcp] could not load client names:',
      clientsResult.error.message,
    );
  }
  if (accountsResult.error) {
    console.warn(
      '[ozer-mcp] could not load workspace names:',
      accountsResult.error.message,
    );
  }

  const projectsById = new Map(
    ((projectsResult.data ?? []) as ProjectNameRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const clientsById = new Map(
    ((clientsResult.data ?? []) as ClientNameRow[]).map((row) => [row.id, row]),
  );

  for (const account of (accountsResult.data ?? []) as McpWorkspace[]) {
    if (account.id) {
      workspacesById.set(account.id, {
        id: account.id,
        name: account.name?.trim() || null,
        slug: account.slug?.trim() || null,
        space_type: account.space_type ?? null,
        is_personal_account: Boolean(account.is_personal_account),
      });
    }
  }

  for (const row of rows) {
    const workspace = row.account_id
      ? workspacesById.get(row.account_id)
      : undefined;

    extras.set(row.id, {
      project_name: projectDisplayName(
        row.project_id ? (projectsById.get(row.project_id) ?? null) : null,
      ),
      client_name: clientDisplayName(
        row.client_id ? (clientsById.get(row.client_id) ?? null) : null,
      ),
      workspace_name: workspace?.name ?? null,
      workspace_slug: workspace?.slug ?? null,
    });
  }

  return extras;
}

async function applyTaskFieldUpdates(
  supabase: SupabaseClient,
  input: z.infer<typeof updateTaskSchema>,
  options?: { requireSubtask?: boolean },
) {
  const updates: Record<string, unknown> = buildTaskUpdates(input);

  if (input.project_id) {
    const { data, error } = await supabase
      .from('projects')
      .select('account_id')
      .eq('id', input.project_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve project');

    const accountId = (data as { account_id?: string | null } | null)
      ?.account_id;
    if (!accountId) {
      throw new Error('Project not found');
    }

    updates.account_id = accountId;
  }

  if (input.area_id) {
    const { data, error } = await supabase
      .from('areas')
      .select('id')
      .eq('id', input.area_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve area');

    if (!data) {
      throw new Error('Area not found');
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one field to update');
  }

  const existing = await loadTaskRow(supabase, input.id, 'load task to update');

  if (options?.requireSubtask && !existing.parent_task_id) {
    throw new Error('Task is not a subtask. Use update_task for root tasks.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', input.id)
    .select(TASK_DETAIL_SELECT)
    .maybeSingle();

  assertSupabaseOk(data, error, 'update task');

  if (!data) {
    throw new Error('Task not found');
  }

  return data as TaskRow;
}

export const registerTaskTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_tasks',
    {
      description:
        'List current outstanding tasks across authorized Ozer workspaces (all clients and projects unless filtered). Defaults: status=outstanding (todo/in_progress/client_review), sort=updated (recently updated first), root tasks only, limit=100. Do not pass client_id or project_id unless the user names a client or project. Use list_workspaces + account_id to focus one workspace. Use offset when meta.truncated is true. Set status=all to include done/cancelled; sort=due for soonest due first (Ozer tasks page). Use list_subtasks or get_task for children.',
      inputSchema: listTasksSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);

      if (
        input.account_id &&
        !workspaces.some((workspace) => workspace.id === input.account_id)
      ) {
        throw new Error('Access denied for this workspace');
      }

      const statuses = resolveTaskListStatuses(input.status);
      const from = input.offset;
      const to = input.offset + input.limit - 1;

      let query = supabase
        .from('tasks')
        .select(TASK_LIST_SELECT, { count: 'exact' })
        .range(from, to);

      if (input.sort === 'due') {
        query = query.order('due_date', {
          ascending: true,
          nullsFirst: false,
        });
      } else {
        query = query
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('due_date', { ascending: true, nullsFirst: false });
      }

      if (statuses) {
        query = query.in('status', [...statuses]);
      }
      if (input.account_id) {
        query = query.eq('account_id', input.account_id);
      }
      if (input.client_id) {
        query = query.eq('client_id', input.client_id);
      }
      if (input.project_id) {
        query = query.eq('project_id', input.project_id);
      }
      if (input.area_id) {
        query = query.eq('area_id', input.area_id);
      }
      if (input.parent_task_id) {
        query = query.eq('parent_task_id', input.parent_task_id);
      } else if (shouldRestrictToRootTasks(input)) {
        query = query.is('parent_task_id', null);
      }
      if (input.mine) {
        query = query.eq('user_id', userId);
      }
      if (input.q) {
        query = query.ilike('title', ilikeContains(input.q));
      }

      const { data, error, count } = await query;
      assertSupabaseOk(data, error, 'list tasks');

      const fetched = (data ?? []) as TaskRow[];
      const rows =
        input.sort === 'priority' ? sortTaskRows(fetched, 'priority') : fetched;
      const extras = await enrichTaskListRows(supabase, rows, workspaces);
      const totalCount = count ?? rows.length;
      const truncated = input.offset + rows.length < totalCount;
      const nextOffset = truncated ? input.offset + rows.length : null;
      const representedWorkspaceIds = uniqueIds(
        rows.map((row) => row.account_id),
      );
      const representedWorkspaces = workspaces.filter((workspace) =>
        representedWorkspaceIds.includes(workspace.id),
      );

      return toolJson({
        tasks: rows.map((row) => mapTask(row, extras.get(row.id))),
        meta: {
          total_count: totalCount,
          returned_count: rows.length,
          limit: input.limit,
          offset: input.offset,
          truncated,
          next_offset: nextOffset,
          status: input.status,
          sort: input.sort,
          workspaces:
            representedWorkspaces.length > 0
              ? representedWorkspaces
              : workspaces,
          authorized_workspaces: workspaces,
          scoped_account_id: input.account_id ?? null,
          filters: {
            client_id: input.client_id ?? null,
            project_id: input.project_id ?? null,
            area_id: input.area_id ?? null,
            parent_task_id: input.parent_task_id ?? null,
            include_subtasks: input.include_subtasks,
            mine: input.mine,
            q: input.q ?? null,
          },
          hint: buildTaskListHint({
            truncated,
            nextOffset,
            workspaceCount: workspaces.length,
            scopedAccountId: input.account_id,
          }),
        },
      });
    },
  );

  server.registerTool(
    'get_task',
    {
      description:
        'Fetch one task by id, including notes, duration_minutes, project/client/workspace/area names, parent_task_id, and a subtasks summary (id, title, status, duration, due date).',
      inputSchema: getTaskSchema,
    },
    async (input) => {
      const task = await loadTaskRow(supabase, input.id);
      const [workspaces, subtasks] = await Promise.all([
        loadUserWorkspaces(supabase, userId),
        loadChildTasks(supabase, task.id),
      ]);
      const assignment = await loadAssignmentNames(supabase, task, workspaces);

      return toolJson({
        task: mapTaskDetail(task, assignment),
        subtasks: subtasks.map(mapSubtask),
        subtasks_summary: summarizeSubtasks(subtasks),
      });
    },
  );

  server.registerTool(
    'create_task',
    {
      description:
        'Create a root task for the authenticated user. duration_minutes is optional estimated effort (max 10080). To add children, use create_subtask with the returned id as parent_task_id.',
      inputSchema: createTaskSchema,
    },
    async (input) => {
      const result = await createTaskForUser(supabase, userId, {
        title: input.title,
        status: input.status,
        priority: input.priority,
        dueDate: input.due_date,
        durationMinutes: input.duration_minutes,
        projectId: input.project_id,
        areaId: input.area_id,
        notes: input.notes,
        source: 'mcp',
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const task = await loadTaskRow(supabase, result.id, 'load created task');
      return toolJson({ task: mapSubtask(task) });
    },
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update a task (root or subtask) owned by the authenticated user. Only provided fields are changed. Supports title, status, priority, due_date, duration_minutes, notes, project_id, and area_id. Use create_subtask / list_subtasks / update_subtask for child tasks.',
      inputSchema: updateTaskSchema,
    },
    async (input) => {
      const task = await applyTaskFieldUpdates(supabase, input);
      return toolJson({ task: mapSubtask(task) });
    },
  );

  server.registerTool(
    'list_subtasks',
    {
      description:
        'List subtasks stored under a parent task (tasks.parent_task_id). The parent must be a task the user can access.',
      inputSchema: listSubtasksSchema,
    },
    async (input) => {
      const parent = await loadTaskRow(
        supabase,
        input.parent_task_id,
        'load parent task',
      );

      const subtasks = await loadChildTasks(supabase, parent.id);

      return toolJson({
        parent_task_id: parent.id,
        parent_title: parent.title,
        subtasks: subtasks.map(mapSubtask),
        subtasks_summary: summarizeSubtasks(subtasks),
      });
    },
  );

  server.registerTool(
    'create_subtask',
    {
      description:
        'Create a subtask under a root parent task. Inherits project/area from the parent. Accepts title plus optional duration_minutes, status, priority, due_date, and notes.',
      inputSchema: createSubtaskSchema,
    },
    async (input) => {
      const parent = await loadTaskRow(
        supabase,
        input.parent_task_id,
        'load parent task',
      );

      if (parent.parent_task_id) {
        throw new Error(
          'Cannot add a subtask to another subtask. Use the root parent task.',
        );
      }

      const result = await createTaskForUser(supabase, userId, {
        title: input.title,
        status: input.status,
        priority: input.priority,
        dueDate: input.due_date,
        durationMinutes: input.duration_minutes,
        notes: input.notes,
        parentTaskId: parent.id,
        parentTaskContext: {
          projectId: parent.project_id,
          areaId: parent.area_id,
          accountId: parent.account_id,
        },
        source: 'mcp',
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const subtask = await loadTaskRow(
        supabase,
        result.id,
        'load created subtask',
      );
      return toolJson({
        subtask: mapSubtask(subtask),
        parent_task_id: parent.id,
      });
    },
  );

  server.registerTool(
    'update_subtask',
    {
      description:
        'Update a subtask (a task with parent_task_id set). Same fields as update_task: title, status, priority, due_date, duration_minutes, notes, and optional project_id/area_id if the child should move independently of its parent. Only provided fields are changed.',
      inputSchema: updateTaskSchema,
    },
    async (input) => {
      const subtask = await applyTaskFieldUpdates(supabase, input, {
        requireSubtask: true,
      });
      return toolJson({ subtask: mapSubtask(subtask) });
    },
  );
};
