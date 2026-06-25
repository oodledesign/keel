import type { PhaseStatus } from '../../_lib/schema/project-phases.schema';

export const DEFAULT_DELIVERY_PHASES = [
  { name: 'Discovery', colour: '#3B82F6' },
  { name: 'Design', colour: '#8B5CF6' },
  { name: 'Build', colour: '#2A9D8F' },
  { name: 'Launch', colour: '#F97316' },
  { name: 'Care', colour: '#64748B' },
] as const;

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  complete: 'Complete',
};

export const PHASE_STATUS_STYLES: Record<PhaseStatus, string> = {
  not_started: 'bg-zinc-600/40 text-zinc-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  blocked: 'bg-red-500/20 text-red-300',
  complete: 'bg-[var(--keel-teal)]/20 text-[#5eead4]',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  client_review: 'Client review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_STYLES: Record<string, string> = {
  todo: 'bg-zinc-600/50 text-zinc-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  client_review: 'bg-purple-500/20 text-purple-300',
  done: 'bg-[var(--keel-teal)]/20 text-[#5eead4]',
  cancelled: 'bg-zinc-700 text-zinc-500',
};

export const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-zinc-400',
  medium: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-rose-500',
  none: 'bg-zinc-500',
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
