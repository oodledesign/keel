export type TicketStatus =
  | 'open'
  | 'in-progress'
  | 'pending_credits'
  | 'waiting'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
