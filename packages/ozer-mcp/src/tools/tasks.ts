import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { createTaskForUser } from '@kit/tasks/create-task';

import { assertSupabaseOk, pickDefined, toolJson } from './shared';
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

const listTasksSchema = z.object({
  status: taskStatusSchema.optional(),
  project_id: z.string().uuid().optional(),
  area_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

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
  'id, title, status, priority, due_date, duration_minutes, project_id, area_id, parent_task_id';
const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, notes, account_id`;

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  duration_minutes: number | null;
  project_id: string | null;
  area_id: string | null;
  parent_task_id?: string | null;
  notes?: string | null;
  account_id?: string | null;
};

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    duration_minutes: row.duration_minutes,
    project_id: row.project_id,
    area_id: row.area_id,
    parent_task_id: row.parent_task_id ?? null,
  };
}

function mapTaskDetail(
  row: TaskRow,
  extras?: { project_name?: string | null; area_name?: string | null },
) {
  return {
    ...mapTask(row),
    notes: row.notes ?? null,
    project_name: extras?.project_name ?? null,
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

async function loadAssignmentNames(
  supabase: SupabaseClient,
  row: TaskRow,
): Promise<{ project_name: string | null; area_name: string | null }> {
  const [projectResult, areaResult] = await Promise.all([
    row.project_id
      ? supabase
          .from('projects')
          .select('id, name, title')
          .eq('id', row.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.area_id
      ? supabase
          .from('areas')
          .select('id, name')
          .eq('id', row.area_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (projectResult.error) {
    console.warn(
      '[ozer-mcp] could not load project name:',
      projectResult.error.message,
    );
  }
  if (areaResult.error) {
    console.warn(
      '[ozer-mcp] could not load area name:',
      areaResult.error.message,
    );
  }

  const project = projectResult.data as {
    name?: string | null;
    title?: string | null;
  } | null;
  const area = areaResult.data as { name?: string | null } | null;

  return {
    project_name: project?.name?.trim() || project?.title?.trim() || null,
    area_name: area?.name?.trim() || null,
  };
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
        'List tasks for the authenticated user with optional filters. Includes duration_minutes and parent_task_id (null for root tasks; set when the row is a subtask). Use list_subtasks or get_task for children of a parent.',
      inputSchema: listTasksSchema,
    },
    async (input) => {
      let query = supabase
        .from('tasks')
        .select(TASK_LIST_SELECT)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(input.limit);

      if (input.status) {
        query = query.eq('status', input.status);
      }
      if (input.project_id) {
        query = query.eq('project_id', input.project_id);
      }
      if (input.area_id) {
        query = query.eq('area_id', input.area_id);
      }
      if (input.parent_task_id) {
        query = query.eq('parent_task_id', input.parent_task_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list tasks');

      return toolJson({
        tasks: (data ?? []).map((row) => mapTask(row as TaskRow)),
      });
    },
  );

  server.registerTool(
    'get_task',
    {
      description:
        'Fetch one task by id, including notes, duration_minutes, project/area, parent_task_id, and a subtasks summary (id, title, status, duration, due date).',
      inputSchema: getTaskSchema,
    },
    async (input) => {
      const task = await loadTaskRow(supabase, input.id);
      const [assignment, subtasks] = await Promise.all([
        loadAssignmentNames(supabase, task),
        loadChildTasks(supabase, task.id),
      ]);

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
