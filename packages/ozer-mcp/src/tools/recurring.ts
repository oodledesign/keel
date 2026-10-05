import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { createTaskForUser } from '@kit/tasks/create-task';

import { assertSupabaseOk, pickDefined, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekdays',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'yearly',
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const priority = z.enum(['low', 'medium', 'high', 'urgent']);

export const createRecurringTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  frequency: z
    .enum(RECURRENCE_FREQUENCIES)
    .describe(
      'daily, weekdays (Mon–Fri), weekly (same weekday as first_date), fortnightly, monthly, quarterly or yearly.',
    ),
  first_date: ymd.describe(
    'When the first task is created (YYYY-MM-DD). For weekly, pick a date on the weekday you want (e.g. a Monday). If today or past, the first task is created immediately.',
  ),
  due_days: z
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
    .describe('Days after each creation date the task is due (default 0).'),
  priority: priority.optional(),
  notes: z.string().max(10000).optional(),
  duration_minutes: z.number().int().positive().max(10080).optional(),
  project_id: z.string().uuid().optional(),
  phase_id: z
    .string()
    .uuid()
    .optional()
    .describe('Phase (on project_id) each new task is placed in.'),
  assignee_user_id: z
    .string()
    .uuid()
    .optional()
    .describe('Team member each task is assigned to (default: you).'),
  end_date: ymd.optional().describe('Stop creating tasks after this date.'),
  max_occurrences: z.number().int().min(1).max(1000).optional(),
});

export const updateRecurringTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  next_date: ymd.optional().describe('Date of the next task to create.'),
  due_days: z.number().int().min(0).max(365).optional(),
  priority: priority.optional(),
  notes: z.string().max(10000).nullable().optional(),
  phase_id: z.string().uuid().nullable().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
});

export const listRecurringTasksSchema = z.object({
  project_id: z.string().uuid().optional(),
  include_ended: z.boolean().optional().default(false),
});

export const deleteRecurringTaskSchema = z.object({ id: z.string().uuid() });

function clampDay(date: Date, day: number) {
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(Math.max(1, day), last));
}

/** Mirrors addTaskRecurrenceFrequency in the web app (task-recurring.server.ts). */
export function nextOccurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  dayOfMonth?: number | null,
): Date {
  const next = new Date(date.getTime());
  const anchor = dayOfMonth ?? next.getUTCDate();
  switch (frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekdays':
      do {
        next.setUTCDate(next.getUTCDate() + 1);
      } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'fortnightly':
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case 'monthly':
    case 'quarterly':
    case 'yearly':
      next.setUTCDate(1);
      if (frequency === 'yearly') {
        next.setUTCFullYear(next.getUTCFullYear() + 1);
      } else {
        next.setUTCMonth(
          next.getUTCMonth() + (frequency === 'monthly' ? 1 : 3),
        );
      }
      clampDay(next, anchor);
      break;
  }
  return next;
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SERIES_SELECT =
  'id, title, frequency, status, next_create_at, due_days, priority, notes, project_id, phase_id, assignee_user_id, account_id, day_of_month, occurrences_created, max_occurrences, end_at';

export const registerRecurringTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  async function projectAccount(
    client: SupabaseClient,
    projectId: string,
  ): Promise<string> {
    const { data, error } = await client
      .from('projects')
      .select('account_id')
      .eq('id', projectId)
      .maybeSingle();
    assertSupabaseOk(data, error, 'resolve project');
    const accountId = (data as { account_id?: string | null } | null)
      ?.account_id;
    if (!accountId) throw new Error('Project not found');
    return accountId;
  }

  server.registerTool(
    'create_recurring_task',
    {
      description:
        'Make a task repeat: daily, every weekday, weekly, fortnightly, monthly, quarterly or yearly (e.g. a Monday scorecard, a weekly user count, 20 calls a day). Creates the series and, if first_date is today or past, the first task right away; later tasks are created automatically each period, titled the same, due due_days after creation. Optionally place them on a project/phase and assign a team member. Use update_recurring_task to pause or change it.',
      inputSchema: createRecurringTaskSchema,
    },
    async (input) => {
      if (input.phase_id && !input.project_id) {
        throw new Error('phase_id needs project_id.');
      }
      const accountId = input.project_id
        ? await projectAccount(supabase, input.project_id)
        : null;

      if (input.phase_id) {
        const { data, error } = await supabase
          .from('project_phases')
          .select('id')
          .eq('id', input.phase_id)
          .eq('project_id', input.project_id as string)
          .maybeSingle();
        assertSupabaseOk(data, error, 'check phase');
        if (!data) throw new Error('Phase does not belong to that project');
      }

      const first = new Date(`${input.first_date}T12:00:00.000Z`);
      const dayOfMonth =
        input.frequency === 'monthly' ||
        input.frequency === 'quarterly' ||
        input.frequency === 'yearly'
          ? first.getUTCDate()
          : null;

      const { data: series, error } = await supabase
        .from('task_recurring_series')
        .insert({
          user_id: userId,
          account_id: accountId,
          title: input.title,
          priority: input.priority ?? 'medium',
          notes: input.notes?.trim() || null,
          duration_minutes: input.duration_minutes ?? null,
          project_id: input.project_id ?? null,
          phase_id: input.phase_id ?? null,
          assignee_user_id: input.assignee_user_id ?? null,
          frequency: input.frequency,
          day_of_month: dayOfMonth,
          next_create_at: first.toISOString(),
          due_days: input.due_days ?? 0,
          end_at: input.end_date ? `${input.end_date}T23:59:59.000Z` : null,
          max_occurrences: input.max_occurrences ?? null,
          occurrences_created: 0,
          status: 'active',
        })
        .select(SERIES_SELECT)
        .single();
      assertSupabaseOk(series, error, 'create recurring task');
      const created = series as { id: string };

      let taskId: string | null = null;
      const today = new Date().toISOString().slice(0, 10);
      if (input.first_date <= today) {
        const result = await createTaskForUser(supabase, userId, {
          title: input.title,
          priority: input.priority ?? 'medium',
          dueDate: addDays(input.first_date, input.due_days ?? 0),
          durationMinutes: input.duration_minutes ?? null,
          projectId: input.project_id,
          phaseId: input.phase_id,
          accountId: accountId ?? undefined,
          assigneeUserId: input.assignee_user_id,
          notes: input.notes,
          source: 'recurring',
          recurringSeriesId: created.id,
        });
        if (!result.success) throw new Error(result.error);
        taskId = result.id;

        const next = nextOccurrence(first, input.frequency, dayOfMonth);
        const ended =
          (input.max_occurrences != null && input.max_occurrences <= 1) ||
          (input.end_date != null &&
            next.toISOString().slice(0, 10) > input.end_date);
        const { error: advanceError } = await supabase
          .from('task_recurring_series')
          .update({
            next_create_at: next.toISOString(),
            occurrences_created: 1,
            status: ended ? 'ended' : 'active',
          })
          .eq('id', created.id);
        assertSupabaseOk(null, advanceError, 'advance recurring series');
      }

      const { data: fresh } = await supabase
        .from('task_recurring_series')
        .select(SERIES_SELECT)
        .eq('id', created.id)
        .maybeSingle();

      return toolJson({ series: fresh ?? series, first_task_id: taskId });
    },
  );

  server.registerTool(
    'list_recurring_tasks',
    {
      description:
        'List recurring task series you own (title, frequency, next creation date, status). Optionally filter to one project. Ended series are hidden unless include_ended is true.',
      inputSchema: listRecurringTasksSchema,
    },
    async (input) => {
      let query = supabase
        .from('task_recurring_series')
        .select(SERIES_SELECT)
        .eq('user_id', userId)
        .order('next_create_at', { ascending: true })
        .limit(200);
      if (input.project_id) query = query.eq('project_id', input.project_id);
      if (!input.include_ended) query = query.neq('status', 'ended');
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list recurring tasks');
      return toolJson({ series: data ?? [] });
    },
  );

  server.registerTool(
    'update_recurring_task',
    {
      description:
        'Change a recurring task series: title, frequency, next date, due_days, priority, notes, phase, assignee, or status (active, paused, ended). Only provided fields change. Tasks already created are not touched.',
      inputSchema: updateRecurringTaskSchema,
    },
    async (input) => {
      const patch: Record<string, unknown> = pickDefined({
        title: input.title,
        frequency: input.frequency,
        due_days: input.due_days,
        priority: input.priority,
        notes:
          input.notes === undefined ? undefined : input.notes?.trim() || null,
        phase_id: input.phase_id,
        assignee_user_id: input.assignee_user_id,
        status: input.status,
      });
      if (input.next_date) {
        patch.next_create_at = `${input.next_date}T12:00:00.000Z`;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('Provide at least one field to update');
      }
      const { data, error } = await supabase
        .from('task_recurring_series')
        .update(patch)
        .eq('id', input.id)
        .eq('user_id', userId)
        .select(SERIES_SELECT)
        .maybeSingle();
      assertSupabaseOk(data, error, 'update recurring task');
      if (!data) throw new Error('Recurring task not found');
      return toolJson({ series: data });
    },
  );

  server.registerTool(
    'delete_recurring_task',
    {
      description:
        'Delete a recurring series so no more tasks are created. Tasks it already created stay (use delete_tasks to remove them). To keep the series but stop it, use update_recurring_task with status=paused.',
      inputSchema: deleteRecurringTaskSchema,
    },
    async (input) => {
      const { data, error } = await supabase
        .from('task_recurring_series')
        .delete()
        .eq('id', input.id)
        .eq('user_id', userId)
        .select('id');
      assertSupabaseOk(data, error, 'delete recurring task');
      if (!data || data.length === 0) {
        throw new Error('Recurring task not found');
      }
      return toolJson({ deleted: true, id: input.id });
    },
  );
};
