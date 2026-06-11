export type PlatformSupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'resolved'
  | 'closed';

export type PlatformSupportTicketPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export const PLATFORM_SUPPORT_STATUSES: PlatformSupportTicketStatus[] = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
];

export const PLATFORM_SUPPORT_PRIORITIES: PlatformSupportTicketPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

export function formatPlatformTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(4, '0')}`;
}
