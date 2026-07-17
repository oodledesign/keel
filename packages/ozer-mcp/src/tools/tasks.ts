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

const listTasksSchema = z.object({
  status: taskStatusSchema.optional(),
  project_id: z.string().uuid().optional(),
  area_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  status: taskStatusSchema.optional().default('todo'),
  priority: taskPrioritySchema.optional().default('medium'),
  due_date: z.string().trim().optional(),
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
  notes: z.string().nullable().optional(),
});

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  area_id: string | null;
};

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

export const registerTaskTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks for the authenticated user with optional filters.',
      inputSchema: listTasksSchema,
    },
    async (input) => {
      let query = supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, project_id, area_id')
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

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list tasks');

      return toolJson({ tasks: (data ?? []).map(mapTask) });
    },
  );

  server.registerTool(
    'create_task',
    {
      description: 'Create a task for the authenticated user.',
      inputSchema: createTaskSchema,
    },
    async (input) => {
      const result = await createTaskForUser(supabase, userId, {
        title: input.title,
        status: input.status,
        priority: input.priority,
        dueDate: input.due_date,
        projectId: input.project_id,
        areaId: input.area_id,
        notes: input.notes,
        source: 'mcp',
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, project_id, area_id')
        .eq('id', result.id)
        .single();

      assertSupabaseOk(data, error, 'load created task');
      return toolJson({ task: mapTask(data as TaskRow) });
    },
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update a task owned by the authenticated user. Only provided fields are changed.',
      inputSchema: updateTaskSchema,
    },
    async (input) => {
      const updates = pickDefined({
        title: input.title,
        status: input.status,
        priority: input.priority,
        due_date: input.due_date,
        notes:
          input.notes === undefined ? undefined : input.notes?.trim() || null,
      });

      if (Object.keys(updates).length === 0) {
        throw new Error('Provide at least one field to update');
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', input.id)
        .select('id, title, status, priority, due_date, project_id, area_id')
        .maybeSingle();

      assertSupabaseOk(data, error, 'update task');

      if (!data) {
        throw new Error('Task not found');
      }

      return toolJson({ task: mapTask(data as TaskRow) });
    },
  );
};
