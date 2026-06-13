export type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProjectGroupId = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export const PROJECT_GROUPS: {
  id: ProjectGroupId;
  label: string;
  accent: string;
  statuses: JobStatus[];
}[] = [
  {
    id: 'upcoming',
    label: 'Upcoming projects',
    accent: '#579bfc',
    statuses: ['pending'],
  },
  {
    id: 'ongoing',
    label: 'Ongoing projects',
    accent: '#fdab3d',
    statuses: ['in_progress', 'on_hold'],
  },
  {
    id: 'completed',
    label: 'Completed projects',
    accent: '#00c875',
    statuses: ['completed'],
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    accent: '#808080',
    statuses: ['cancelled'],
  },
];

export const JOB_STATUS_CELL: Record<
  JobStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: "Haven't started", bg: '#579bfc', text: '#ffffff' },
  in_progress: { label: 'On track', bg: '#00c875', text: '#ffffff' },
  on_hold: { label: 'On hold', bg: '#fdab3d', text: '#1e293b' },
  completed: { label: 'Done', bg: '#00c875', text: '#ffffff' },
  cancelled: { label: 'Cancelled', bg: '#808080', text: '#ffffff' },
};

export const PRIORITY_CELL: Record<
  JobPriority,
  { label: string; bg: string; text: string }
> = {
  low: { label: 'Low', bg: '#579bfc', text: '#ffffff' },
  medium: { label: 'Medium', bg: '#5559df', text: '#ffffff' },
  high: { label: 'High', bg: '#a25ddc', text: '#ffffff' },
  urgent: { label: 'Urgent', bg: '#e2445c', text: '#ffffff' },
};

export const PHASE_CELL: Record<
  ProjectGroupId,
  { label: string; bg: string; text: string }
> = {
  upcoming: { label: 'Upcoming', bg: '#ff5ac4', text: '#ffffff' },
  ongoing: { label: 'Ongoing', bg: '#fdab3d', text: '#1e293b' },
  completed: { label: 'Completed', bg: '#00c875', text: '#ffffff' },
  cancelled: { label: 'Cancelled', bg: '#808080', text: '#ffffff' },
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
