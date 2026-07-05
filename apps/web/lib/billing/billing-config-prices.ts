/**
 * Read marketing prices only from apps/web/config/billing.config.ts.
 * Never hardcode list prices and never query the database.
 */

import billingConfig from '~/config/billing.config';

export type BillingPlanPrice = {
  productId: string;
  productName: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  monthlyPlanId: string | null;
  yearlyPlanId: string | null;
  monthlyPriceGbp: number;
  yearlyPriceGbp: number | null;
  trialDays: number | null;
  /** Max team members when stated in features (null = not a seat-limited business tier). */
  maxTeamMembers: number | null;
};

export type BillingProductPlanPrice = {
  productId: string;
  productName: string;
  planId: string;
  planName: string;
  interval: 'month' | 'year';
  priceGbp: number;
};

function lineCost(plan: {
  lineItems: Array<{ cost: number; type: string }>;
}): number {
  const flat = plan.lineItems.find((item) => item.type === 'flat');
  return flat?.cost ?? plan.lineItems[0]?.cost ?? 0;
}

function parseMaxTeamMembers(features: string[]): number | null {
  for (const feature of features) {
    const match = feature.match(/up to\s+(\d+)\s+team members/i);
    if (match) return Number(match[1]);
    if (/1 team member/i.test(feature)) return 1;
  }
  return null;
}

function productPrices(productId: string): BillingPlanPrice | null {
  const product = billingConfig.products.find((p) => p.id === productId);
  if (!product) return null;

  const monthly = product.plans.find((p) => p.interval === 'month');
  const yearly = product.plans.find((p) => p.interval === 'year');
  const features = [...(product.features ?? [])];

  return {
    productId: product.id,
    productName: product.name,
    description: product.description ?? '',
    features,
    highlighted: Boolean(
      'highlighted' in product ? product.highlighted : false,
    ),
    badge:
      'badge' in product && typeof product.badge === 'string'
        ? product.badge
        : undefined,
    monthlyPlanId: monthly?.id ?? null,
    yearlyPlanId: yearly?.id ?? null,
    monthlyPriceGbp: monthly ? lineCost(monthly) : 0,
    yearlyPriceGbp: yearly ? lineCost(yearly) : null,
    trialDays: monthly?.trialDays ?? yearly?.trialDays ?? null,
    maxTeamMembers: parseMaxTeamMembers(features),
  };
}

export const BILLING_TRIAL_DAYS = (() => {
  for (const product of billingConfig.products) {
    for (const plan of product.plans) {
      if (plan.trialDays) return plan.trialDays;
    }
  }
  return 14;
})();

export function getBillingProductPrice(
  productId: string,
): BillingPlanPrice | null {
  return productPrices(productId);
}

export function listBillingProductPlanPrices(
  productId: string,
): BillingProductPlanPrice[] {
  const product = billingConfig.products.find((p) => p.id === productId);
  if (!product) return [];

  return product.plans.flatMap((plan) => {
    if (plan.interval !== 'month' && plan.interval !== 'year') {
      return [];
    }

    return {
      productId: product.id,
      productName: product.name,
      planId: plan.id,
      planName: plan.name,
      interval: plan.interval,
      priceGbp: lineCost(plan),
    };
  });
}

export function listBusinessWorkspacePrices(): BillingPlanPrice[] {
  return [
    'keel-business-lite',
    'keel-business-solo',
    'keel-business-team',
    'keel-business-scale',
  ]
    .map((id) => productPrices(id))
    .filter((p): p is BillingPlanPrice => Boolean(p));
}

export function listCommunityPrices(): BillingPlanPrice[] {
  const plan = productPrices('keel-community');
  return plan ? [plan] : [];
}

export function listPropertyPrices(): BillingPlanPrice[] {
  return ['keel-property-starter', 'keel-property-portfolio']
    .map((id) => productPrices(id))
    .filter((p): p is BillingPlanPrice => Boolean(p));
}

export function listAllWorkspacePrices(): BillingPlanPrice[] {
  return [
    ...listCommunityPrices(),
    ...listBusinessWorkspacePrices(),
    ...listPropertyPrices(),
  ];
}

/** Exact annual saving percentage when paying yearly vs 12× monthly. */
export function annualSavingPercent(plan: BillingPlanPrice): number | null {
  if (plan.yearlyPriceGbp == null || plan.monthlyPriceGbp <= 0) return null;
  const monthlyAnnualised = plan.monthlyPriceGbp * 12;
  if (monthlyAnnualised <= plan.yearlyPriceGbp) return 0;
  return (
    ((monthlyAnnualised - plan.yearlyPriceGbp) / monthlyAnnualised) * 100
  );
}

export function formatAnnualSavingPercent(plan: BillingPlanPrice): string | null {
  const pct = annualSavingPercent(plan);
  if (pct == null) return null;
  // Truth-check: never round up to a marketing "20%" when the maths is 16.7%.
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function perPersonMonthly(
  plan: BillingPlanPrice,
  teamSize: number,
): number | null {
  if (plan.monthlyPriceGbp <= 0) return 0;
  const seats = plan.maxTeamMembers ?? teamSize;
  const effective = Math.min(teamSize, seats);
  if (effective <= 0) return null;
  return plan.monthlyPriceGbp / effective;
}

export function formatGbp(amount: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function translationLine(plan: BillingPlanPrice): string {
  if (plan.monthlyPriceGbp === 0) {
    return '£0 per month — free forever for this workspace type.';
  }

  if (plan.maxTeamMembers === 1) {
    return `Less than one billable hour a month at a £50/hour rate (£${plan.monthlyPriceGbp} per month).`;
  }

  if (plan.maxTeamMembers && plan.maxTeamMembers >= 4) {
    const perPerson = plan.monthlyPriceGbp / 4;
    return `For a 4-person studio, that is ${formatGbp(perPerson, 2)} per person per month (flat price for the whole team, up to ${plan.maxTeamMembers} members).`;
  }

  if (plan.maxTeamMembers) {
    const perPerson = plan.monthlyPriceGbp / plan.maxTeamMembers;
    return `Up to ${plan.maxTeamMembers} members — ${formatGbp(perPerson, 2)} per person per month if you fill every seat.`;
  }

  return `${formatGbp(plan.monthlyPriceGbp)} per month, flat price for the whole team.`;
}

export function trialLabel(plan: BillingPlanPrice): string {
  if (plan.monthlyPriceGbp === 0) {
    return 'Free forever — no card, no trial clock.';
  }
  const days = plan.trialDays ?? BILLING_TRIAL_DAYS;
  return `${days}-day free trial on your first paid workspace.`;
}

export const PRICING_LAST_VERIFIED = '2026-07-04';
