import type { TicketPriority, TicketStatus } from './ticket-status.types';

export type { TicketPriority, TicketStatus } from './ticket-status.types';

/** Cream-friendly status chips (readable on light panels). */
export const ticketStatusStyles: Record<
  TicketStatus,
  { bg: string; text: string; label: string }
> = {
  open: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-800',
    label: 'Open',
  },
  'in-progress': {
    bg: 'bg-amber-500/15',
    text: 'text-amber-900',
    label: 'In progress',
  },
  waiting: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-900',
    label: 'Waiting',
  },
  resolved: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-900',
    label: 'Resolved',
  },
  closed: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-700',
    label: 'Closed',
  },
};

export const ticketPriorityStyles: Record<
  TicketPriority,
  { bg: string; text: string; label: string }
> = {
  low: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-700',
    label: 'Low',
  },
  medium: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-800',
    label: 'Medium',
  },
  high: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-900',
    label: 'High',
  },
  urgent: {
    bg: 'bg-red-500/15',
    text: 'text-red-800',
    label: 'Urgent',
  },
};

export function ticketStatusLabel(status: string): string {
  return (
    ticketStatusStyles[status as TicketStatus]?.label ??
    status.replace(/-/g, ' ')
  );
}

export function TicketStatusBadge({
  status,
}: {
  status: TicketStatus | string;
}) {
  const style =
    ticketStatusStyles[status as TicketStatus] ?? ticketStatusStyles.open;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority | string;
}) {
  const style =
    ticketPriorityStyles[priority as TicketPriority] ??
    ticketPriorityStyles.medium;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
