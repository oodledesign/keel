import { getSafeRedirectPath } from '@kit/shared/utils';

import pathsConfig from '~/config/paths.config';
import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  clampBillableSeats,
  estimateMonthlyGbp,
  freeSupportSeats,
  illustrativeTierForSeats,
} from '~/lib/billing/commercial-graduated-pricing';
import {
  type SetupIntent,
  buildSetupPath,
  formatGbp,
} from '~/lib/billing/pricing-marketing';

export type SignupContext = {
  /** Document title / short identity */
  heading: string;
  /** Longer page description (metadata / unused UI fallback) */
  subheading: string;
  /** Left-panel eyebrow, e.g. "You can easily" */
  brandEyebrow: string;
  /** Left-panel headline under the eyebrow */
  brandHeadline: string;
  /** Right-panel form title */
  formTitle: string;
  /** Right-panel form subtitle */
  formSubtitle: string;
  badge?: string;
  highlights: string[];
  intent: SetupIntent | null;
  /** When true, show plan/seats confirm before the account form */
  showPlanConfirm: boolean;
};

export function isCommercialSignupIntent(intent: SetupIntent | null): boolean {
  if (!intent) return false;
  return (
    intent.profile === 'commercial_property' ||
    intent.productId === COMMERCIAL_GRADUATED_PRODUCT_ID ||
    intent.planId === COMMERCIAL_GRADUATED_PLAN_ID
  );
}

/** Build commercial signup copy for a given seat count (client + server safe). */
export function buildCommercialSignupContext(
  intent: SetupIntent,
  seatsOverride?: number,
): SignupContext {
  const seats = clampBillableSeats(seatsOverride ?? intent.seats ?? 4);
  const tier = illustrativeTierForSeats(seats);
  const monthly = estimateMonthlyGbp(seats);
  const support = freeSupportSeats(seats);
  const resolvedIntent: SetupIntent = {
    ...intent,
    profile: 'commercial_property',
    productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
    planId: COMMERCIAL_GRADUATED_PLAN_ID,
    seats,
  };

  return {
    heading: 'Create your commercial property account',
    subheading: `Confirm ${seats} billable seat${seats === 1 ? '' : 's'} (${tier.label}), then create your account. Estimated ${formatGbp(monthly)}/mo after trial.`,
    brandEyebrow: 'You can easily',
    brandHeadline:
      'Get access to your commercial desk for listings, pipeline, and publishing.',
    formTitle: 'Create an account',
    formSubtitle:
      'Set up your agency workspace — listings, requirements, and portals in one place.',
    badge:
      `${tier.label} · ${seats} seat${seats === 1 ? '' : 's'} · trial on paid plans`.toUpperCase(),
    highlights: [
      `Graduated per-seat pricing (${formatGbp(monthly)}/mo for ${seats} seat${seats === 1 ? '' : 's'})`,
      'Listings, pipeline & requirements',
      support > 0
        ? `${support} free support seats included on ${tier.label}`
        : 'Portal publishing included from Solo',
    ],
    intent: resolvedIntent,
    showPlanConfirm: true,
  };
}

export function buildCommercialSetupNext(seats: number): string {
  return buildSetupPath({
    profile: 'commercial_property',
    productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
    planId: COMMERCIAL_GRADUATED_PLAN_ID,
    seats: clampBillableSeats(seats),
  });
}

export function buildAuthLinkWithNext(
  basePath: string,
  next: string | undefined,
) {
  if (!next?.trim()) return basePath;
  const safe = getSafeRedirectPath(next, pathsConfig.app.home);
  return `${basePath}?next=${encodeURIComponent(safe)}`;
}
