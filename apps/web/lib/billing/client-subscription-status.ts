import type { ClientSubscriptionStatus } from '~/lib/billing/plan-templates-types';

/** Display label for agency/client UI (Stripe-aligned wording for past due). */
export function clientSubscriptionStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'overdue':
      return 'Past due';
    case 'cancelled':
      return 'Cancelled';
    case 'incomplete':
    case 'pending':
      return 'Pending setup';
    default:
      return status;
  }
}

export function mapStripeSubscriptionStatus(
  status: string,
): ClientSubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'overdue';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'incomplete':
      return 'incomplete';
    case 'paused':
      return 'pending';
    default:
      return 'pending';
  }
}

export const clientSubscriptionStatusStyles: Record<
  ClientSubscriptionStatus,
  { bg: string; text: string }
> = {
  active: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700',
  },
  overdue: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-800',
  },
  cancelled: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-600',
  },
  incomplete: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700',
  },
  pending: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700',
  },
};
