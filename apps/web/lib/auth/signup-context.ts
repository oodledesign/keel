import 'server-only';

import { getSafeRedirectPath } from '@kit/shared/utils';

import pathsConfig from '~/config/paths.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { getBillingProductPrice } from '~/lib/billing/billing-config-prices';
import {
  MARKETING_FREE_TIER,
  type SetupIntent,
  parseSetupIntent,
} from '~/lib/billing/pricing-marketing';

import {
  buildBusinessSignupContext,
  isBusinessSignupIntent,
} from './signup-context-business';
import {
  type SignupContext,
  buildCommercialSignupContext,
  isCommercialSignupIntent,
} from './signup-context-commercial';

export type { SignupContext } from './signup-context-commercial';
export {
  buildAuthLinkWithNext,
  buildCommercialSignupContext,
  isCommercialSignupIntent,
} from './signup-context-commercial';
export {
  buildBusinessSignupContext,
  isBusinessSignupIntent,
} from './signup-context-business';

const PERSONAL_FIRST_HIGHLIGHTS = [
  'Free personal hub — tasks, people, notes & planner',
  'Workspaces are optional — add one when you need it',
  'Apps like Signatures start on free Business Lite',
] as const;

const PROFILE_LABEL: Record<WorkspaceProfile, string> = {
  work_design: 'business',
  work_property: 'property',
  commercial_property: 'commercial property',
  building_surveyor: 'building surveyor',
  family: 'family',
  community: 'community',
};

function isSetupPath(path: string) {
  return (
    path === pathsConfig.app.workspaceSetup ||
    path.startsWith(`${pathsConfig.app.workspaceSetup}?`)
  );
}

function parseIntentFromNext(next: string | undefined): SetupIntent | null {
  if (!next?.trim()) return null;

  const path = getSafeRedirectPath(next, pathsConfig.app.home);
  if (!isSetupPath(path)) return null;

  const url = new URL(path, 'http://ozer.local');
  return parseSetupIntent(url.searchParams);
}

function productHighlights(productId: string | undefined, fallback: string[]) {
  if (!productId) return fallback;
  const product = getBillingProductPrice(productId);
  if (!product?.features?.length) return fallback;
  return product.features.slice(0, 3);
}

function withPersonalDefaults(
  partial: Omit<
    SignupContext,
    | 'brandEyebrow'
    | 'brandHeadline'
    | 'formTitle'
    | 'formSubtitle'
    | 'showPlanConfirm'
  > &
    Partial<
      Pick<
        SignupContext,
        | 'brandEyebrow'
        | 'brandHeadline'
        | 'formTitle'
        | 'formSubtitle'
        | 'showPlanConfirm'
      >
    >,
): SignupContext {
  return {
    brandEyebrow: partial.brandEyebrow ?? 'You can easily',
    brandHeadline:
      partial.brandHeadline ??
      'Get access to your personal hub for clarity and productivity.',
    formTitle: partial.formTitle ?? 'Create an account',
    formSubtitle:
      partial.formSubtitle ??
      'Access your tasks, notes, and projects anytime — and keep everything flowing in one place.',
    showPlanConfirm: partial.showPlanConfirm ?? false,
    heading: partial.heading,
    subheading: partial.subheading,
    badge: partial.badge,
    highlights: partial.highlights,
    intent: partial.intent,
  };
}

/** Resolve marketing copy for the sign-up page from the post-auth `next` path. */
export function resolveSignupContext(next: string | undefined): SignupContext {
  const intent = parseIntentFromNext(next);

  if (!intent) {
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading:
        'Your personal hub is free forever. After signup you can add a business, family, or community workspace — or explore personal-only first.',
      badge: 'Free forever · no card to start',
      highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
      intent: null,
    });
  }

  if (isCommercialSignupIntent(intent)) {
    return buildCommercialSignupContext(intent);
  }

  // Empty setup path = personal-only intent from /start
  if (!intent.profile && !intent.productId && !intent.planId) {
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading:
        'No workspace required yet — start with personal tasks, people, notes, and planner. Add Business, family, or community when you need them.',
      badge: 'Personal free · workspaces optional',
      highlights: [
        'Free personal account — always yours',
        'People, notes, tasks & planner included',
        'Add a business workspace anytime',
      ],
      intent,
    });
  }

  if (
    intent.productId === 'ozer-business-lite' ||
    intent.planId === 'business-lite-free'
  ) {
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading:
        'Your personal hub comes first. Next you’ll add a free Business Lite workspace to install apps like Signatures.',
      badge: 'Free personal + Lite · no card',
      highlights: [
        'Free personal tasks, people, notes & planner',
        'Business Lite workspace for apps like Signatures',
        'Upgrade to Business when you need CRM',
      ],
      intent,
      brandHeadline:
        'Get access to your personal hub — then add Business Lite for apps.',
    });
  }

  if (isBusinessSignupIntent(intent)) {
    return buildBusinessSignupContext(intent);
  }

  const product = intent.productId
    ? getBillingProductPrice(intent.productId)
    : null;

  if (product && product.monthlyPriceGbp > 0) {
    const intervalLabel = intent.interval === 'year' ? 'year' : 'month';
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading: `Your personal hub comes first. After signup you’ll set up ${product.productName} (14-day trial, then £${product.monthlyPriceGbp}/${intervalLabel}).`,
      badge: 'Personal free · trial on paid plans',
      highlights: productHighlights(intent.productId, [
        ...PERSONAL_FIRST_HIGHLIGHTS,
      ]),
      intent,
      brandHeadline: `Get access to your personal hub, then set up ${product.productName}.`,
    });
  }

  if (intent.profile === 'family' || intent.profile === 'community') {
    const label = PROFILE_LABEL[intent.profile];
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading: `Your personal hub is included. Next you’ll add a ${label} workspace. ${MARKETING_FREE_TIER.description}`,
      badge: 'No credit card',
      highlights: [...MARKETING_FREE_TIER.features],
      intent,
      brandHeadline: `Get access to your personal hub — then add a ${label} workspace.`,
    });
  }

  if (intent.profile === 'work_property') {
    return withPersonalDefaults({
      heading: 'Create your free personal account',
      subheading:
        'Ozer starts with you. After signup, add a property workspace when you are ready.',
      badge: 'Free personal · property when ready',
      highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
      intent,
    });
  }

  return withPersonalDefaults({
    heading: 'Create your free personal account',
    subheading:
      'After you sign up, add workspaces for business, family, or community. Most studios start on graduated Business from £29 for seat 1.',
    badge: 'Free to start',
    highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
    intent,
  });
}
