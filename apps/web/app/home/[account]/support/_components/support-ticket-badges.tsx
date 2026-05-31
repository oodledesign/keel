import type {
  TicketPriority,
  TicketStatus,
} from '../_lib/schema/support-tickets.schema';

export const ticketStatusStyles: Record<
  TicketStatus,
  { bg: string; text: string; label: string }
> = {
  open: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    label: 'Open',
  },
  'in-progress': {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    label: 'In progress',
  },
  waiting: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    label: 'Waiting',
  },
  resolved: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    label: 'Resolved',
  },
  closed: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    label: 'Closed',
  },
};

export const ticketPriorityStyles: Record<
  TicketPriority,
  { bg: string; text: string; label: string }
> = {
  low: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    label: 'Low',
  },
  medium: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    label: 'Medium',
  },
  high: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    label: 'High',
  },
  urgent: {
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    label: 'Urgent',
  },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const style = ticketStatusStyles[status] ?? ticketStatusStyles.open;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const style = ticketPriorityStyles[priority] ?? ticketPriorityStyles.medium;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function formatTicketDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(3, '0')}`;
}
