import {
  canPayClientSubscription,
  clientSubscriptionCheckoutHref,
} from './client-subscription-lifecycle';
import { isOfflineBillingCollection } from './plan-templates-types';

const PAYMENT_ISSUE_STATUSES = new Set([
  'overdue',
  'past_due',
  'unpaid',
  'failed',
]);

export type PortalPaymentNoticeInput = {
  id: string;
  planName: string;
  status: string | null | undefined;
  billingCollection?: string | null;
};

export type PortalPaymentNotice = {
  kind: 'pending' | 'issue';
  subscriptionId: string;
  planName: string;
  /** Stripe checkout for a payable pending retainer. Null for payment issues. */
  checkoutHref: string | null;
  /** Other notices of the same kind, besides the one in this bar. */
  extraCount: number;
};

function isPaymentIssue(row: PortalPaymentNoticeInput) {
  if (isOfflineBillingCollection(row.billingCollection)) return false;
  return PAYMENT_ISSUE_STATUSES.has(String(row.status ?? ''));
}

/**
 * One shell-level notice. Payment issues (past due / failed) win over
 * retainers that still need first checkout.
 */
export function selectPortalPaymentNotice(
  rows: PortalPaymentNoticeInput[],
): PortalPaymentNotice | null {
  const issues = rows.filter(isPaymentIssue);
  if (issues.length > 0) {
    const primary = issues[0]!;
    return {
      kind: 'issue',
      subscriptionId: primary.id,
      planName: primary.planName.trim() || 'Subscription',
      checkoutHref: null,
      extraCount: issues.length - 1,
    };
  }

  const pending = rows.filter((row) => canPayClientSubscription(row));
  if (pending.length === 0) return null;

  const primary = pending[0]!;
  return {
    kind: 'pending',
    subscriptionId: primary.id,
    planName: primary.planName.trim() || 'Subscription',
    checkoutHref: clientSubscriptionCheckoutHref(primary.id),
    extraCount: pending.length - 1,
  };
}
