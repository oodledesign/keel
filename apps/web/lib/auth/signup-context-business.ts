import {
  BUSINESS_GRADUATED_PLAN_ID,
  BUSINESS_GRADUATED_PRODUCT_ID,
  aiCreditsForBillableSeats,
  clampBillableSeats,
  estimateMonthlyGbp,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import {
  BUSINESS_STARTER_PLAN_ID,
  BUSINESS_STARTER_PRODUCT_ID,
  estimateStarterMonthlyGbp,
  maxProjectGuestsForStarterBillableSeats,
} from '~/lib/billing/business-starter-pricing';
import {
  type SetupIntent,
  buildSetupPath,
  formatGbp,
} from '~/lib/billing/pricing-marketing';

import type { SignupContext } from './signup-context-commercial';

export type BusinessPaidPlan = 'starter' | 'pro';

export function resolveBusinessPaidPlan(
  intent: Pick<SetupIntent, 'productId' | 'planId'> | null | undefined,
): BusinessPaidPlan {
  if (
    intent?.productId === BUSINESS_STARTER_PRODUCT_ID ||
    Boolean(intent?.planId?.startsWith('business-starter'))
  ) {
    return 'starter';
  }

  return 'pro';
}

export function isBusinessSignupIntent(intent: SetupIntent | null): boolean {
  if (!intent) return false;
  if (
    intent.productId === 'ozer-business-lite' ||
    intent.planId === 'business-lite-free'
  ) {
    return false;
  }

  // Profile alone (e.g. /work Start free without a plan) still shows seat confirm,
  // matching Commercial Property. Paid product / legacy Solo–Scale links also qualify.
  return (
    intent.profile === 'work_design' ||
    intent.productId === BUSINESS_GRADUATED_PRODUCT_ID ||
    intent.productId === BUSINESS_STARTER_PRODUCT_ID ||
    intent.planId === BUSINESS_GRADUATED_PLAN_ID ||
    intent.planId === BUSINESS_STARTER_PLAN_ID ||
    intent.planId === 'business-yearly' ||
    intent.productId === 'ozer-business-solo' ||
    intent.productId === 'ozer-business-team' ||
    intent.productId === 'ozer-business-scale' ||
    Boolean(intent.planId?.startsWith('business-solo')) ||
    Boolean(intent.planId?.startsWith('business-team')) ||
    Boolean(intent.planId?.startsWith('business-scale')) ||
    Boolean(intent.planId?.startsWith('business-starter'))
  );
}

function productAndPlanFor(
  paidPlan: BusinessPaidPlan,
  interval: SetupIntent['interval'],
): { productId: string; planId: string } {
  if (paidPlan === 'starter') {
    return {
      productId: BUSINESS_STARTER_PRODUCT_ID,
      planId: BUSINESS_STARTER_PLAN_ID,
    };
  }

  return {
    productId: BUSINESS_GRADUATED_PRODUCT_ID,
    planId:
      interval === 'year' ? 'business-yearly' : BUSINESS_GRADUATED_PLAN_ID,
  };
}

/** Build Business signup copy for a given seat count (client + server safe). */
export function buildBusinessSignupContext(
  intent: SetupIntent,
  seatsOverride?: number,
  paidPlanOverride?: BusinessPaidPlan,
): SignupContext {
  const seats = clampBillableSeats(seatsOverride ?? intent.seats ?? 4);
  const paidPlan = paidPlanOverride ?? resolveBusinessPaidPlan(intent);
  const isStarter = paidPlan === 'starter';
  const planLabel = isStarter ? 'Starter' : 'Pro';
  const monthly = isStarter
    ? estimateStarterMonthlyGbp(seats)
    : estimateMonthlyGbp(seats);
  const guests = isStarter
    ? maxProjectGuestsForStarterBillableSeats(seats)
    : maxProjectGuestsForBillableSeats(seats);
  const { productId, planId } = productAndPlanFor(paidPlan, intent.interval);
  const resolvedIntent: SetupIntent = {
    ...intent,
    profile: 'work_design',
    productId,
    planId,
    seats,
  };

  const highlights = isStarter
    ? [
        `Graduated pricing (${formatGbp(monthly)}/mo for ${seats} seat${seats === 1 ? '' : 's'})`,
        'Shared AI credit pool · clients, projects & invoices',
        `${guests} project guest${guests === 1 ? '' : 's'} · 10 GB portal storage`,
      ]
    : [
        `Graduated pricing (${formatGbp(monthly)}/mo for ${seats} seat${seats === 1 ? '' : 's'})`,
        `${aiCreditsForBillableSeats(seats).toLocaleString()} shared AI credits / month`,
        `${guests} project guest${guests === 1 ? '' : 's'} · 25 GB portal storage`,
      ];

  return {
    heading: 'Create your business account',
    subheading: `Confirm ${planLabel} with ${seats} billable seat${seats === 1 ? '' : 's'}, then create your account. Estimated ${formatGbp(monthly)}/mo after trial.`,
    brandEyebrow: 'You can easily',
    brandHeadline:
      'Get access to your studio workspace for clients, projects, and invoices.',
    formTitle: 'Create an account',
    formSubtitle:
      'Set up your business workspace — clients, projects, and AI in one place.',
    badge:
      `${planLabel} · ${seats} seat${seats === 1 ? '' : 's'} · 14-day trial, no card`.toUpperCase(),
    highlights,
    intent: resolvedIntent,
    showPlanConfirm: true,
  };
}

export function buildBusinessSetupNext(
  seats: number,
  interval?: 'month' | 'year',
  paidPlan: BusinessPaidPlan = 'pro',
): string {
  const { productId, planId } = productAndPlanFor(paidPlan, interval);

  return buildSetupPath({
    profile: 'work_design',
    productId,
    planId,
    seats: clampBillableSeats(seats),
    interval: interval === 'year' ? 'year' : 'month',
  });
}
