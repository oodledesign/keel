import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '~/components/support/ticket-status-badge';
import {
  ticketPriorityStyles,
  ticketStatusLabel,
  ticketStatusStyles,
} from '~/components/support/ticket-status-badge';

import type {
  TicketPriority,
  TicketStatus,
} from '../_lib/schema/support-tickets.schema';

export {
  TicketPriorityBadge,
  TicketStatusBadge,
  ticketPriorityStyles,
  ticketStatusLabel,
  ticketStatusStyles,
};

export type { TicketPriority, TicketStatus };

export function formatTicketDate(value: string | null | undefined) {
  if (!value) return '—';
  // Bare YYYY-MM-DD is UTC midnight in JS; noon local avoids off-by-one labels.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  return new Date(normalized).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTicketNumber(ticketNumber: number) {
  return `#${ticketNumber}`;
}
