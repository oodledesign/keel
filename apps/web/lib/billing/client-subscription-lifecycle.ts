import { isOfflineBillingCollection } from './plan-templates-types';

export function isPendingClientSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return status === 'pending' || status === 'incomplete';
}

export function isLiveClientSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return status === 'active' || status === 'overdue';
}

export function isRemovedClientSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return status === 'cancelled';
}

export function canPayClientSubscription(row: {
  status: string | null | undefined;
  billingCollection?: string | null;
}): boolean {
  return (
    isPendingClientSubscriptionStatus(row.status) &&
    !isOfflineBillingCollection(row.billingCollection)
  );
}

export function canRemoveClientSubscription(status: string | null | undefined) {
  return !isRemovedClientSubscriptionStatus(status);
}

export function isVisibleAgencyClientSubscription(
  status: string | null | undefined,
): boolean {
  return (
    isLiveClientSubscriptionStatus(status) ||
    isPendingClientSubscriptionStatus(status)
  );
}

export function clientSubscriptionCheckoutHref(subscriptionId: string): string {
  return `/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscriptionId)}`;
}

export function portalBillingReturnPath(
  slug: string,
  outcome: 'paid' | 'cancelled',
): string {
  const query = outcome === 'paid' ? 'paid=1' : 'checkout=cancelled';
  return `/portal/${encodeURIComponent(slug)}/billing?${query}`;
}

export function selectPortalPlanSubscriptions<
  T extends {
    status: string | null | undefined;
    billingCollection?: string | null;
  },
>(rows: T[]): { active: T | null; live: T[]; pending: T[] } {
  const pending = rows.filter((row) => canPayClientSubscription(row));
  const live = rows.filter((row) => isLiveClientSubscriptionStatus(row.status));

  return { active: live[0] ?? null, live, pending };
}

/** Name the project on portal plan/billing when the client has more than one. */
export function shouldNamePortalPlanProject(planCount: number): boolean {
  return planCount > 1;
}
