/**
 * Soft tinted task-status pills for project board / list / portal cards.
 * Same visual language as campaign status chips (Ozer gold / sage / info / coral).
 */

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Client review',
  done: 'Done',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
};

const SOFT_PILL = {
  gold: 'bg-[color-mix(in_srgb,var(--ozer-gold-500)_20%,transparent)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-gold-500)_42%,transparent)] dark:text-[var(--ozer-gold-500)]',
  sage: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-sage-500)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--ozer-sage-500)_18%,transparent)] dark:text-[var(--ozer-sage-300)]',
  info: 'bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--ozer-info)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-info)_28%,transparent)]',
  accent:
    'bg-[color-mix(in_srgb,var(--ozer-accent)_15%,transparent)] text-[var(--ozer-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-accent)_32%,transparent)]',
  coral:
    'bg-[var(--ozer-accent-muted)] text-[var(--ozer-coral-600)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-coral-600)_40%,transparent)]',
  muted:
    'bg-[color-mix(in_srgb,var(--ozer-text-muted)_18%,transparent)] text-[var(--workspace-shell-text-muted)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
} as const;

export const TASK_STATUS_BADGE_CLASS = {
  todo: SOFT_PILL.gold,
  in_progress: SOFT_PILL.info,
  client_review: SOFT_PILL.accent,
  done: SOFT_PILL.sage,
  cancelled: SOFT_PILL.muted,
  blocked: SOFT_PILL.coral,
  unknown: SOFT_PILL.muted,
} as const;

export type TaskStatusBadgeKey = keyof typeof TASK_STATUS_BADGE_CLASS;

const TODO_ALIASES = new Set([
  'todo',
  'to_do',
  'open',
  'pending',
  'not_started',
]);
const DONE_ALIASES = new Set(['done', 'completed', 'complete']);
const IN_PROGRESS_ALIASES = new Set(['in_progress', 'inprogress']);
const REVIEW_ALIASES = new Set([
  'client_review',
  'review',
  'in_review',
  'awaiting_client',
]);
const CANCELLED_ALIASES = new Set(['cancelled', 'canceled']);
const BLOCKED_ALIASES = new Set(['blocked']);

function normalizeStatusKey(status: string | null | undefined): string {
  return (status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function resolveTaskStatusBadgeKey(
  status: string | null | undefined,
): TaskStatusBadgeKey {
  const key = normalizeStatusKey(status);
  if (!key) return 'todo';
  if (TODO_ALIASES.has(key)) return 'todo';
  if (DONE_ALIASES.has(key)) return 'done';
  if (IN_PROGRESS_ALIASES.has(key)) return 'in_progress';
  if (REVIEW_ALIASES.has(key)) return 'client_review';
  if (CANCELLED_ALIASES.has(key)) return 'cancelled';
  if (BLOCKED_ALIASES.has(key)) return 'blocked';
  return 'unknown';
}

export function taskStatusBadgeClass(
  status: string | null | undefined,
): string {
  return TASK_STATUS_BADGE_CLASS[resolveTaskStatusBadgeKey(status)];
}

export function taskStatusLabel(status: string | null | undefined): string {
  const key = resolveTaskStatusBadgeKey(status);
  if (key !== 'unknown') {
    return TASK_STATUS_LABELS[key] ?? TASK_STATUS_LABELS.todo;
  }

  const raw = (status ?? '').trim();
  if (!raw) return TASK_STATUS_LABELS.todo;

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Exact-key map for existing `TASK_STATUS_STYLES.todo` lookups. */
export const TASK_STATUS_STYLES: Record<string, string> = {
  todo: TASK_STATUS_BADGE_CLASS.todo,
  in_progress: TASK_STATUS_BADGE_CLASS.in_progress,
  client_review: TASK_STATUS_BADGE_CLASS.client_review,
  done: TASK_STATUS_BADGE_CLASS.done,
  cancelled: TASK_STATUS_BADGE_CLASS.cancelled,
  blocked: TASK_STATUS_BADGE_CLASS.blocked,
};
