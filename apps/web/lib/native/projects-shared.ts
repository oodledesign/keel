import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';
import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';
import {
  DEFAULT_PROJECT_STATUS_SEEDS,
  type ProjectStatus,
  closedProjectStatusSlugs,
  fallbackProjectStatuses,
  projectStatusLabel,
} from '~/lib/projects/project-statuses';
import { deliveryProjectTitle } from '~/lib/projects/project-types';
import { computeTaskProgress } from '~/lib/tasks/compute-task-progress';

import { NativeHttpError } from './http';
import { type NativeTask } from './task-map';
import { mapNativeTaskStatus } from './task-status';
import { isUuid } from './workspace-shared';

/** Same business profiles as Clients / Invoices — not personal, family, or community. */
export const NATIVE_PROJECT_WORKSPACE_PROFILES = [
  'work_design',
  'commercial_property',
  'building_surveyor',
] as const;

export type NativeProjectWorkspaceProfile =
  (typeof NATIVE_PROJECT_WORKSPACE_PROFILES)[number];

export function workspaceShowsNativeProjects(
  profile: string | null | undefined,
) {
  return (NATIVE_PROJECT_WORKSPACE_PROFILES as readonly string[]).includes(
    profile ?? '',
  );
}

export type NativeProjectListStatus = 'open' | 'done' | 'all';

export function parseNativeProjectListStatus(
  value: string | null | undefined,
): NativeProjectListStatus {
  if (value == null || value.trim() === '') {
    return 'open';
  }

  switch (value.trim().toLowerCase()) {
    case 'open':
    case 'active':
      return 'open';
    case 'done':
    case 'completed':
      return 'done';
    case 'all':
      return 'all';
    default:
      throw new NativeHttpError(400, 'status must be open, done, or all');
  }
}

export type NativeProjectClientRow = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  client_type?: string | null;
};

export type NativeProjectRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  status?: string | null;
  description?: string | null;
  client_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  is_ongoing?: boolean | null;
  is_phased?: boolean | null;
  value_pence?: number | null;
  project_type?: string | null;
  clients?: NativeProjectClientRow | NativeProjectClientRow[] | null;
};

export type NativeProjectStatusColumn = {
  slug: string;
  label: string;
  category: 'open' | 'completed' | 'cancelled';
};

export type NativeProjectTaskCounts = {
  open: number;
  done: number;
  total: number;
};

export type NativeProject = {
  id: string;
  title: string;
  status: string;
  status_label: string;
  client_id: string | null;
  client_name: string | null;
  start: string | null;
  due: string | null;
  is_ongoing: boolean;
  is_phased: boolean;
  value: string | null;
  value_pence: number | null;
  progress_pct: number;
  task_counts: NativeProjectTaskCounts;
};

export type NativeProjectPhase = {
  id: string;
  name: string;
  status: string;
  status_label: string;
  is_milestone: boolean;
  colour: string | null;
  start: string | null;
  due: string | null;
  progress_pct: number;
  task_count: number;
};

export type NativeProjectTask = NativeTask & {
  phase_id: string | null;
  phase_name: string | null;
  parent_task_id: string | null;
};

export type NativeProjectDetail = NativeProject & {
  description: string | null;
  phases: NativeProjectPhase[];
  tasks: NativeProjectTask[];
  default_board_mode: 'phase' | 'progress';
};

export type NativeProjectProgressRow = {
  id?: string | null;
  project_id?: string | null;
  phase_id?: string | null;
  status?: string | null;
  parent_task_id?: string | null;
  duration_minutes?: number | null;
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  complete: 'Complete',
};

export function dateOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export function parseOptionalProjectId(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isUuid(trimmed)) {
    throw new NativeHttpError(404, 'Project not found');
  }
  return trimmed;
}

export function firstClientEmbed(
  value: NativeProjectRow['clients'],
): NativeProjectClientRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function nativeProjectClientName(
  row: NativeProjectClientRow | null | undefined,
): string | null {
  if (!row) return null;
  const name = resolveClientListTitle(row).trim();
  return name || null;
}

export function nativeProjectValue(
  pence: number | null | undefined,
  currency = 'gbp',
): { value: string | null; value_pence: number | null } {
  if (typeof pence !== 'number' || !Number.isFinite(pence) || pence <= 0) {
    return { value: null, value_pence: null };
  }

  return {
    value: formatWorkspaceMoney(Math.round(pence), currency),
    value_pence: Math.round(pence),
  };
}

export function nativePhaseStatusLabel(status: string | null | undefined) {
  const slug = status?.trim() || 'not_started';
  return PHASE_STATUS_LABELS[slug] ?? slug.replace(/_/g, ' ');
}

export function emptyTaskCounts(): NativeProjectTaskCounts {
  return { open: 0, done: 0, total: 0 };
}

export function countNativeProjectTasks(
  tasks: Array<{ status?: string | null }>,
): NativeProjectTaskCounts {
  let open = 0;
  let done = 0;

  for (const task of tasks) {
    if (mapNativeTaskStatus(task.status) === 'completed') {
      done += 1;
    } else {
      open += 1;
    }
  }

  return { open, done, total: open + done };
}

export function progressFromTaskRows(rows: NativeProjectProgressRow[]): number {
  if (rows.length === 0) return 0;

  return computeTaskProgress(
    rows.map((row, index) => ({
      id: row.id?.trim() || `task-${index}`,
      status: row.status ?? 'todo',
      parent_task_id: row.parent_task_id ?? null,
      duration_minutes: row.duration_minutes ?? null,
    })),
  ).progressPct;
}

export function mapNativeProjectStatusColumns(
  statuses: readonly ProjectStatus[],
): NativeProjectStatusColumn[] {
  const source = statuses.length > 0 ? statuses : fallbackProjectStatuses();

  return source.map((status) => ({
    slug: status.slug,
    label: status.label,
    category: status.category,
  }));
}

export function closedNativeProjectStatusSlugs(
  statuses: readonly ProjectStatus[],
): string[] {
  return closedProjectStatusSlugs(
    statuses.length > 0 ? statuses : fallbackProjectStatuses(),
  );
}

export function nativeProjectStatusLabel(
  slug: string | null | undefined,
  statuses: readonly ProjectStatus[] = [],
) {
  return projectStatusLabel(
    slug,
    statuses.length > 0 ? statuses : fallbackProjectStatuses(),
  );
}

export function defaultNativeProjectStatuses(accountId = ''): ProjectStatus[] {
  return fallbackProjectStatuses(accountId);
}

export function mapNativeProject(
  row: NativeProjectRow,
  extras?: {
    clientName?: string | null;
    statuses?: readonly ProjectStatus[];
    progressPct?: number;
    taskCounts?: NativeProjectTaskCounts;
    currency?: string | null;
  },
): NativeProject {
  const money = nativeProjectValue(row.value_pence, extras?.currency ?? 'gbp');
  const clientName =
    extras?.clientName ??
    nativeProjectClientName(firstClientEmbed(row.clients));

  return {
    id: row.id,
    title: deliveryProjectTitle(row),
    status: row.status?.trim() || DEFAULT_PROJECT_STATUS_SEEDS[0]!.slug,
    status_label: nativeProjectStatusLabel(row.status, extras?.statuses),
    client_id: row.client_id?.trim() || null,
    client_name: clientName,
    start: dateOnly(row.start_date),
    due: row.is_ongoing ? null : dateOnly(row.due_date),
    is_ongoing: Boolean(row.is_ongoing),
    is_phased: Boolean(row.is_phased),
    value: money.value,
    value_pence: money.value_pence,
    progress_pct: extras?.progressPct ?? 0,
    task_counts: extras?.taskCounts ?? emptyTaskCounts(),
  };
}

export function mapNativePhase(input: {
  id: string;
  name?: string | null;
  status?: string | null;
  is_milestone?: boolean | null;
  colour?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  progress_pct?: number;
  task_count?: number;
}): NativeProjectPhase {
  return {
    id: input.id,
    name: input.name?.trim() || 'Untitled phase',
    status: input.status?.trim() || 'not_started',
    status_label: nativePhaseStatusLabel(input.status),
    is_milestone: Boolean(input.is_milestone),
    colour: input.colour?.trim() || null,
    start: dateOnly(input.start_date),
    due: dateOnly(input.due_date),
    progress_pct: input.progress_pct ?? 0,
    task_count: input.task_count ?? 0,
  };
}
