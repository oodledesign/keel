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

export type PlatformSupportTicketCategory =
  | 'bug'
  | 'feedback'
  | 'feature_request'
  | 'question'
  | 'billing'
  | 'other';

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

export const PLATFORM_SUPPORT_CATEGORIES: PlatformSupportTicketCategory[] = [
  'bug',
  'feedback',
  'feature_request',
  'question',
  'billing',
  'other',
];

export const PLATFORM_SUPPORT_CATEGORY_LABELS: Record<
  PlatformSupportTicketCategory,
  string
> = {
  bug: 'Bug',
  feedback: 'Feedback',
  feature_request: 'Feature request',
  question: 'Question',
  billing: 'Billing',
  other: 'Other',
};

export function formatPlatformSupportCategory(
  category: string | null | undefined,
) {
  if (!category) return 'Question';
  return (
    PLATFORM_SUPPORT_CATEGORY_LABELS[
      category as PlatformSupportTicketCategory
    ] ?? category.replace(/_/g, ' ')
  );
}

export function formatPlatformTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(4, '0')}`;
}
