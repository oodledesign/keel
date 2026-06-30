import type { PhaseStatus } from '../../_lib/schema/project-phases.schema';
import { ozerColors } from '~/lib/ozer/design-tokens';

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
  not_started: 'bg-[var(--workspace-shell-panel-hover)]/40 text-[var(--workspace-shell-text-muted)]',
  in_progress: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
  blocked: 'bg-red-500/20 text-red-400',
  complete: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Client review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_STYLES: Record<string, string> = {
  todo: 'bg-[var(--workspace-shell-panel-hover)]/50 text-[var(--workspace-shell-text-muted)]',
  in_progress: 'bg-[var(--ozer-info)]/15 text-[var(--ozer-info)]',
  client_review: 'bg-[var(--ozer-coral-alpha-15)] text-[var(--ozer-accent-muted)]',
  done: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
  cancelled: 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text-muted)]',
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
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
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
