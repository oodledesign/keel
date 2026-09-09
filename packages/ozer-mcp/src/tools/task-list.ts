import { z } from 'zod';

import { OPEN_TASK_STATUSES } from './shared';

export const TASK_LIST_DEFAULT_LIMIT = 100;
export const TASK_LIST_MAX_LIMIT = 300;

export const taskListStatusSchema = z.enum([
  'outstanding',
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
  'all',
]);

export const taskListSortSchema = z.enum(['updated', 'due', 'priority']);

export const listTasksSchema = z.object({
  status: taskListStatusSchema.optional().default('outstanding'),
  account_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  area_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  include_subtasks: z.boolean().optional().default(false),
  mine: z.boolean().optional().default(false),
  q: z.string().trim().min(1).max(200).optional(),
  sort: taskListSortSchema.optional().default('updated'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(TASK_LIST_MAX_LIMIT)
    .optional()
    .default(TASK_LIST_DEFAULT_LIMIT),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;
export type TaskListStatus = z.infer<typeof taskListStatusSchema>;
export type TaskListSort = z.infer<typeof taskListSortSchema>;

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function resolveTaskListStatuses(
  status: TaskListStatus,
): readonly string[] | null {
  if (status === 'outstanding') {
    return OPEN_TASK_STATUSES;
  }

  if (status === 'all') {
    return null;
  }

  return [status];
}

export function shouldRestrictToRootTasks(input: {
  parent_task_id?: string;
  include_subtasks?: boolean;
}): boolean {
  return !input.parent_task_id && !input.include_subtasks;
}

export function ilikeContains(value: string): string {
  return `%${value.replace(/[%_\\]/g, '\\$&')}%`;
}

export function priorityRank(priority: string | null | undefined): number {
  if (!priority) {
    return 4;
  }

  return PRIORITY_RANK[priority] ?? 4;
}

export function compareTasksBySort<
  T extends {
    priority?: string | null;
    due_date?: string | null;
    updated_at?: string | null;
  },
>(left: T, right: T, sort: TaskListSort): number {
  if (sort === 'priority') {
    const byPriority =
      priorityRank(left.priority) - priorityRank(right.priority);
    if (byPriority !== 0) {
      return byPriority;
    }
  }

  if (sort === 'due' || sort === 'priority') {
    const dueCompare = compareDueDates(left.due_date, right.due_date);
    if (dueCompare !== 0) {
      return dueCompare;
    }
  }

  return compareTimestampsDesc(left.updated_at, right.updated_at);
}

export function sortTaskRows<
  T extends {
    priority?: string | null;
    due_date?: string | null;
    updated_at?: string | null;
  },
>(rows: T[], sort: TaskListSort): T[] {
  return [...rows].sort((left, right) => compareTasksBySort(left, right, sort));
}

export function buildTaskListHint(input: {
  truncated: boolean;
  nextOffset: number | null;
  workspaceCount: number;
  scopedAccountId?: string;
}): string {
  const parts = [
    'Defaults to outstanding tasks (todo, in_progress, client_review) across authorized workspaces, all clients/projects, recently updated first.',
  ];

  if (input.scopedAccountId) {
    parts.push(`Scoped to workspace ${input.scopedAccountId}.`);
  } else if (input.workspaceCount > 1) {
    parts.push(
      'Multiple workspaces are authorized. Pass account_id from list_workspaces to focus on one.',
    );
  }

  if (input.truncated && input.nextOffset != null) {
    parts.push(`Pass offset=${input.nextOffset} for the next page.`);
  }

  parts.push(
    'Add client_id or project_id only when the user names a client or project.',
  );

  return parts.join(' ');
}

function compareDueDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (left && right && left !== right) {
    return left.localeCompare(right);
  }

  if (left && !right) {
    return -1;
  }

  if (!left && right) {
    return 1;
  }

  return 0;
}

function compareTimestampsDesc(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (left && right && left !== right) {
    return right.localeCompare(left);
  }

  if (left && !right) {
    return -1;
  }

  if (!left && right) {
    return 1;
  }

  return 0;
}
