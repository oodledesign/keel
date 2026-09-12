/**
 * Soft tinted task-status pills for project board / list / timeline.
 * Colours follow Dan’s mapping; campaign-style color-mix tints stay readable
 * on light Ozer cards. Custom statuses match by slug or display label.
 */

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  open: 'Open',
  in_progress: 'In progress',
  client_review: 'Client review',
  done: 'Done',
  completed: 'Done',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  blocked: 'Blocked',
};

export const TASK_STATUS_TONE = {
  todo: 'todo',
  in_progress: 'in_progress',
  client_review: 'client_review',
  done: 'done',
  cancelled: 'cancelled',
  blocked: 'blocked',
  unknown: 'unknown',
} as const;

export type TaskStatusTone = (typeof TASK_STATUS_TONE)[keyof typeof TASK_STATUS_TONE];

/** Soft pills — same language as campaign / listing chips (tinted, not neon). */
export const TASK_STATUS_BADGE_CLASS: Record<TaskStatusTone, string> = {
  todo: 'bg-[color-mix(in_srgb,var(--ozer-gold-500)_20%,transparent)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-gold-500)_42%,transparent)] dark:text-[var(--ozer-gold-500)]',
  in_progress:
    'bg-[color-mix(in_srgb,var(--ozer-accent)_16%,transparent)] text-[var(--ozer-coral-600)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-accent)_36%,transparent)] dark:text-[var(--ozer-coral-400)]',
  client_review:
    'bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--ozer-info)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-info)_28%,transparent)] dark:text-[var(--ozer-sky-200)]',
  done: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-sage-500)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--ozer-sage-500)_18%,transparent)] dark:text-[var(--ozer-sage-300)]',
  cancelled:
    'bg-[color-mix(in_srgb,var(--ozer-text-muted)_18%,transparent)] text-[var(--workspace-shell-text-muted)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
  blocked: 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400',
  unknown:
    'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
};

const TONE_BY_KEY: Record<string, TaskStatusTone> = {
  todo: 'todo',
  to_do: 'todo',
  open: 'todo',
  not_started: 'todo',
  notstarted: 'todo',
  in_progress: 'in_progress',
  inprogress: 'in_progress',
  client_review: 'client_review',
  clientreview: 'client_review',
  review: 'client_review',
  in_review: 'client_review',
  awaiting_client: 'client_review',
  done: 'done',
  completed: 'done',
  complete: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  blocked: 'blocked',
};

export function normalizeTaskStatusKey(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveTaskStatusTone(
  status: string | null | undefined,
  label?: string | null,
): TaskStatusTone {
  const slugTone = TONE_BY_KEY[normalizeTaskStatusKey(status)];
  if (slugTone) return slugTone;

  const labelTone = TONE_BY_KEY[normalizeTaskStatusKey(label)];
  if (labelTone) return labelTone;

  return 'unknown';
}

export function taskStatusBadgeClass(
  status: string | null | undefined,
  label?: string | null,
): string {
  return TASK_STATUS_BADGE_CLASS[resolveTaskStatusTone(status, label)];
}

export function taskStatusDisplayLabel(
  status: string | null | undefined,
  label?: string | null,
): string {
  const trimmedLabel = label?.trim();
  if (trimmedLabel) return trimmedLabel;

  const key = normalizeTaskStatusKey(status);
  if (key && TASK_STATUS_LABELS[key]) {
    return TASK_STATUS_LABELS[key];
  }

  if (!status?.trim()) return 'To do';

  return status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Known-status lookup used by existing board/progress call sites. */
export const TASK_STATUS_STYLES: Record<string, string> = {
  todo: TASK_STATUS_BADGE_CLASS.todo,
  open: TASK_STATUS_BADGE_CLASS.todo,
  in_progress: TASK_STATUS_BADGE_CLASS.in_progress,
  client_review: TASK_STATUS_BADGE_CLASS.client_review,
  done: TASK_STATUS_BADGE_CLASS.done,
  completed: TASK_STATUS_BADGE_CLASS.done,
  cancelled: TASK_STATUS_BADGE_CLASS.cancelled,
  canceled: TASK_STATUS_BADGE_CLASS.cancelled,
  blocked: TASK_STATUS_BADGE_CLASS.blocked,
};

export const TASK_STATUS_PILL_CHROME =
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase';

export function taskStatusSelectClass(
  status: string | null | undefined,
  label?: string | null,
): string {
  return `${TASK_STATUS_PILL_CHROME} border-0 shadow-none outline-none ${taskStatusBadgeClass(status, label)}`;
}
