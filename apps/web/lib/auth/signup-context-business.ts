import {
  BUSINESS_GRADUATED_PLAN_ID,
  BUSINESS_GRADUATED_PRODUCT_ID,
  aiCreditsForBillableSeats,
  clampBillableSeats,
  estimateMonthlyGbp,
  illustrativeTierForSeats,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import {
  type SetupIntent,
  buildSetupPath,
  formatGbp,
} from '~/lib/billing/pricing-marketing';

import type { SignupContext } from './signup-context-commercial';

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
    intent.planId === BUSINESS_GRADUATED_PLAN_ID ||
    intent.planId === 'business-yearly' ||
    intent.productId === 'ozer-business-solo' ||
    intent.productId === 'ozer-business-team' ||
    intent.productId === 'ozer-business-scale' ||
    Boolean(intent.planId?.startsWith('business-solo')) ||
    Boolean(intent.planId?.startsWith('business-team')) ||
    Boolean(intent.planId?.startsWith('business-scale'))
  );
}

/** Build Business signup copy for a given seat count (client + server safe). */
export function buildBusinessSignupContext(
  intent: SetupIntent,
  seatsOverride?: number,
): SignupContext {
  const seats = clampBillableSeats(seatsOverride ?? intent.seats ?? 4);
  const tier = illustrativeTierForSeats(seats);
  const monthly = estimateMonthlyGbp(seats);
  const credits = aiCreditsForBillableSeats(seats);
  const guests = maxProjectGuestsForBillableSeats(seats);
  const resolvedIntent: SetupIntent = {
    ...intent,
    profile: 'work_design',
    productId: BUSINESS_GRADUATED_PRODUCT_ID,
    planId:
      intent.interval === 'year'
        ? 'business-yearly'
        : BUSINESS_GRADUATED_PLAN_ID,
    seats,
  };

  return {
    heading: 'Create your business account',
    subheading: `Confirm ${seats} billable seat${seats === 1 ? '' : 's'} (${tier.label}), then create your account. Estimated ${formatGbp(monthly)}/mo after trial.`,
    brandEyebrow: 'You can easily',
    brandHeadline:
      'Get access to your studio workspace for clients, projects, and invoices.',
    formTitle: 'Create an account',
    formSubtitle:
      'Set up your business workspace — clients, projects, and AI in one place.',
    badge:
      `${tier.label} · ${seats} seat${seats === 1 ? '' : 's'} · 14-day trial, no card`.toUpperCase(),
    highlights: [
      `Graduated pricing (${formatGbp(monthly)}/mo for ${seats} seat${seats === 1 ? '' : 's'})`,
      `${credits.toLocaleString()} shared AI credits / month`,
      `${guests} project guest${guests === 1 ? '' : 's'} · unlimited client portals`,
    ],
    intent: resolvedIntent,
    showPlanConfirm: true,
  };
}

export function buildBusinessSetupNext(
  seats: number,
  interval?: 'month' | 'year',
): string {
  return buildSetupPath({
    profile: 'work_design',
    productId: BUSINESS_GRADUATED_PRODUCT_ID,
    planId:
      interval === 'year' ? 'business-yearly' : BUSINESS_GRADUATED_PLAN_ID,
    seats: clampBillableSeats(seats),
    interval: interval === 'year' ? 'year' : 'month',
  });
}
