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
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTicketNumber(ticketNumber: number) {
  return `#${ticketNumber}`;
}
