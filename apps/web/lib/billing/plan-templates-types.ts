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
  createdAt: string;
  updatedAt: string;
};

export type ClientSubscriptionStatus =
  | 'pending'
  | 'incomplete'
  | 'active'
  | 'overdue'
  | 'cancelled';

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
