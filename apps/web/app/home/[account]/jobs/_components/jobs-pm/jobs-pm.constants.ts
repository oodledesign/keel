import { ozerColors, ozerStatusColors } from '~/lib/ozer/design-tokens';

export type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProjectGroupId = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

const onDark = ozerColors.white;
const onLight = ozerColors.plum;

export const PROJECT_GROUPS: {
  id: ProjectGroupId;
  label: string;
  accent: string;
  statuses: JobStatus[];
}[] = [
  {
    id: 'upcoming',
    label: 'Upcoming projects',
    accent: ozerStatusColors.pending,
    statuses: ['pending'],
  },
  {
    id: 'ongoing',
    label: 'Ongoing projects',
    accent: ozerStatusColors.onHold,
    statuses: ['in_progress', 'on_hold'],
  },
  {
    id: 'completed',
    label: 'Completed projects',
    accent: ozerStatusColors.completed,
    statuses: ['completed'],
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    accent: ozerStatusColors.cancelled,
    statuses: ['cancelled'],
  },
];

export const JOB_STATUS_CELL: Record<
  JobStatus,
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: "Haven't started",
    bg: ozerStatusColors.pending,
    text: onDark,
  },
  in_progress: {
    label: 'On track',
    bg: ozerStatusColors.inProgress,
    text: onDark,
  },
  on_hold: { label: 'On hold', bg: ozerStatusColors.onHold, text: onLight },
  completed: { label: 'Done', bg: ozerStatusColors.completed, text: onDark },
  cancelled: {
    label: 'Cancelled',
    bg: ozerStatusColors.cancelled,
    text: onDark,
  },
};

export const PRIORITY_CELL: Record<
  JobPriority,
  { label: string; bg: string; text: string }
> = {
  low: { label: 'Low', bg: ozerStatusColors.pending, text: onDark },
  medium: { label: 'Medium', bg: '#5559df', text: onDark },
  high: { label: 'High', bg: '#a25ddc', text: onDark },
  urgent: { label: 'Urgent', bg: ozerStatusColors.urgent, text: onDark },
};

export const PHASE_CELL: Record<
  ProjectGroupId,
  { label: string; bg: string; text: string }
> = {
  upcoming: { label: 'Upcoming', bg: '#ff5ac4', text: onDark },
  ongoing: { label: 'Ongoing', bg: ozerStatusColors.onHold, text: onLight },
  completed: {
    label: 'Completed',
    bg: ozerStatusColors.completed,
    text: onDark,
  },
  cancelled: {
    label: 'Cancelled',
    bg: ozerStatusColors.cancelled,
    text: onDark,
  },
};

export function getProjectGroupId(status: string): ProjectGroupId {
  if (status === 'pending') return 'upcoming';
  if (status === 'in_progress' || status === 'on_hold') return 'ongoing';
  if (status === 'completed') return 'completed';
  return 'cancelled';
}

export function formatTimelineRange(
  start: string | null,
  due: string | null,
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });

  if (start && due) return `${fmt(start)} – ${fmt(due)}`;
  if (due) return `Due ${fmt(due)}`;
  if (start) return `From ${fmt(start)}`;
  return '—';
}

export function formatValue(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(0)}`;
}

export function truncateText(text: string | null, max = 72): string {
  if (!text?.trim()) return '—';
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
