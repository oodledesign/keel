export const RETAINER_TIMEZONE = 'Europe/London';

/** Auto-apply only at or above this confidence (existing project service). */
export const AUTO_MATCH_CONFIDENCE = 0.85;

/** Below this, treat an AI pick as a weak/no match and climb the ladder. */
export const WEAK_MATCH_CONFIDENCE = 0.55;

export const UNDO_WINDOW_HOURS = 24;

export const UNDO_WINDOW_MS = UNDO_WINDOW_HOURS * 60 * 60 * 1000;

export const RETAINER_MATCH_KINDS = [
  'project_service',
  'workspace_service',
  'propose_new',
  'uncategorised',
] as const;

export type RetainerMatchKind = (typeof RETAINER_MATCH_KINDS)[number];

export const RETAINER_SUGGESTION_STATUSES = [
  'pending',
  'applied',
  'skipped',
  'auto_applied',
] as const;

export type RetainerSuggestionStatus =
  (typeof RETAINER_SUGGESTION_STATUSES)[number];

export const TASK_STATUS_VALUES = [
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
] as const;

export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];
