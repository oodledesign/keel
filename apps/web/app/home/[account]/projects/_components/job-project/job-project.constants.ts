import { ozerColors } from '~/lib/ozer/design-tokens';

import type { PhaseStatus } from '../../_lib/schema/project-phases.schema';

export const DEFAULT_DELIVERY_PHASES = [
  { name: 'Discovery', colour: ozerColors.info },
  { name: 'Design', colour: '#8B5CF6' },
  { name: 'Build', colour: ozerColors.accent },
  { name: 'Launch', colour: ozerColors.gold },
  { name: 'Care', colour: ozerColors.muted },
] as const;

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  complete: 'Complete',
};

export const PHASE_STATUS_STYLES: Record<PhaseStatus, string> = {
  not_started:
    'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)]',
  in_progress:
    'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
  blocked: 'bg-red-500/15 text-red-700 dark:text-red-400',
  complete: 'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Client review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_STYLES: Record<string, string> = {
  todo: 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text-muted)]',
  in_progress: 'bg-[var(--ozer-info)]/15 text-[var(--ozer-info)]',
  client_review:
    'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
  done: 'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]',
  cancelled:
    'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text-muted)]',
};

/** Column accent colours for the Progress (status) kanban. */
export const PROGRESS_STATUS_COLOURS: Record<string, string> = {
  todo: '#64748B',
  in_progress: ozerColors.info,
  client_review: ozerColors.accent,
  done: '#16A34A',
};

export const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-[var(--workspace-shell-text-muted)]',
  medium: 'bg-[var(--ozer-info)]',
  high: 'bg-[var(--ozer-gold-500)]',
  urgent: 'bg-[var(--ozer-accent)]',
  none: 'bg-[var(--workspace-shell-panel-hover)]',
};

export const UNPHASED_KEY = '__unphased__';

export function formatShortDate(iso: string | null | undefined): string {
  const d = parseDateKey(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatValuePence(pence: number | null | undefined): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

export function parseDateKey(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}
