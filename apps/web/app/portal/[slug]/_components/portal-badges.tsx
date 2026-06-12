import type {
  PortalTicketPriority,
  PortalTicketStatus,
} from '../_lib/schema/portal.schema';

export const portalTicketStatusStyles: Record<
  PortalTicketStatus,
  { bg: string; text: string; label: string }
> = {
  open: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700',
    label: 'Open',
  },
  'in-progress': {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700',
    label: 'In progress',
  },
  waiting: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-700',
    label: 'Waiting',
  },
  resolved: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700',
    label: 'Resolved',
  },
  closed: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-600',
    label: 'Closed',
  },
};

export const portalTicketPriorityStyles: Record<
  PortalTicketPriority,
  { bg: string; text: string; label: string }
> = {
  low: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-600',
    label: 'Low',
  },
  medium: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700',
    label: 'Medium',
  },
  high: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700',
    label: 'High',
  },
  urgent: {
    bg: 'bg-red-500/15',
    text: 'text-red-700',
    label: 'Urgent',
  },
};

export function PortalTicketStatusBadge({
  status,
}: {
  status: PortalTicketStatus;
}) {
  const style =
    portalTicketStatusStyles[status] ?? portalTicketStatusStyles.open;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function PortalTicketPriorityBadge({
  priority,
}: {
  priority: PortalTicketPriority;
}) {
  const style =
    portalTicketPriorityStyles[priority] ?? portalTicketPriorityStyles.medium;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function portalExternalHref(url: string | null | undefined) {
  if (!url?.trim()) return null;
  const value = url.trim();
  return value.startsWith('http') ? value : `https://${value}`;
}

export function formatPortalTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(3, '0')}`;
}

export function formatPortalDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPortalMoney(
  amount: number | null,
  currency: string | null | undefined,
) {
  if (amount == null) return '—';
  const code = (currency ?? 'GBP').toUpperCase();
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: code,
  }).format(amount);
}
