/**
 * G2 — Workspace recurring offerings (hosting / retainers / care plans).
 */

export type PlanTemplateKind = 'hosting' | 'retainer' | 'care_plan' | 'custom';

export type PlanBillingInterval = 'month' | 'year';

export type PlanTemplateRecord = {
  id: string;
  accountId: string;
  kind: PlanTemplateKind;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: PlanBillingInterval;
  stripeProductId: string | null;
  stripePriceId: string | null;
  active: boolean;
  creditsPerCycle: number | null;
  rolloverPolicy: 'expire' | 'rollover' | 'cap';
  rolloverCap: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientSubscriptionStatus =
  | 'pending'
  | 'incomplete'
  | 'active'
  | 'overdue'
  | 'cancelled';

/** How the agency collects this client plan. */
export type ClientSubscriptionBillingCollection = 'stripe' | 'offline';

export type ClientSubscriptionRecord = {
  id: string;
  accountId: string;
  businessId: string | null;
  clientId: string | null;
  clientOrgId: string | null;
  websiteId: string | null;
  planTemplateId: string | null;
  planName: string | null;
  subscriptionKind: PlanTemplateKind | null;
  monthlyAmount: number;
  currency: string;
  status: ClientSubscriptionStatus;
  billingCollection: ClientSubscriptionBillingCollection;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  stripePaymentLink: string | null;
  stripeCheckoutSessionId: string | null;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionLineItemRecord = {
  id: string;
  clientSubscriptionId: string;
  accountId: string;
  planTemplateId: string | null;
  kind: PlanTemplateKind | null;
  description: string;
  amount: number;
  currency: string;
  interval: PlanBillingInterval;
  stripePriceId: string | null;
};

export const PLAN_TEMPLATE_KINDS: PlanTemplateKind[] = [
  'hosting',
  'retainer',
  'care_plan',
  'custom',
];

export function planTemplateKindLabel(kind: PlanTemplateKind): string {
  switch (kind) {
    case 'hosting':
      return 'Hosting';
    case 'retainer':
      return 'Retainer';
    case 'care_plan':
      return 'Care plan';
    default:
      return 'Custom';
  }
}

export function formatMinorUnits(
  amount: number,
  currency = 'gbp',
  interval?: PlanBillingInterval,
): string {
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);

  if (!interval) return formatted;
  return `${formatted}/${interval === 'year' ? 'year' : 'month'}`;
}

export function parseBillingCollection(
  value: unknown,
): ClientSubscriptionBillingCollection {
  return value === 'offline' ? 'offline' : 'stripe';
}

export function isOfflineBillingCollection(
  value: string | null | undefined,
): boolean {
  return value === 'offline';
}

export function clientSubscriptionBillingLabel(
  collection: string | null | undefined,
): string | null {
  return collection === 'offline' ? 'Invoiced offline' : null;
}

export function nextBillingDateFromInterval(
  interval: PlanBillingInterval,
  from = new Date(),
): string {
  const next = new Date(from.getTime());
  if (interval === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}

export function canResendClientSubscriptionPaymentLink(row: {
  status: string;
  billingCollection?: string | null;
}): boolean {
  if (isOfflineBillingCollection(row.billingCollection)) return false;
  return (
    row.status === 'overdue' ||
    row.status === 'incomplete' ||
    row.status === 'pending'
  );
}

export function canActivateClientSubscriptionOffline(row: {
  status: string;
  billingCollection?: string | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  if (row.stripeSubscriptionId) return false;
  if (
    isOfflineBillingCollection(row.billingCollection) &&
    row.status === 'active'
  ) {
    return false;
  }
  return row.status === 'pending' || row.status === 'incomplete';
}
