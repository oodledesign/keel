import 'server-only';

import { getSafeRedirectPath } from '@kit/shared/utils';

import pathsConfig from '~/config/paths.config';
import { getBillingProductPrice } from '~/lib/billing/billing-config-prices';
import {
  MARKETING_FREE_TIER,
  type SetupIntent,
  parseSetupIntent,
} from '~/lib/billing/pricing-marketing';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

export type SignupContext = {
  heading: string;
  subheading: string;
  badge?: string;
  highlights: string[];
  intent: SetupIntent | null;
};

const PERSONAL_FIRST_HIGHLIGHTS = [
  'Free personal hub — tasks, people, notes & planner',
  'Workspaces are optional — add one when you need it',
  'Apps like Signatures start on free Business Lite',
] as const;

const PROFILE_LABEL: Record<WorkspaceProfile, string> = {
  work_design: 'business',
  work_property: 'property',
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

function isPaidBusinessProduct(productId: string | undefined) {
  return (
    Boolean(productId?.startsWith('ozer-business-')) &&
    productId !== 'ozer-business-lite'
  );
}

/** Resolve marketing copy for the sign-up page from the post-auth `next` path. */
export function resolveSignupContext(next: string | undefined): SignupContext {
  const intent = parseIntentFromNext(next);

  if (!intent) {
    return {
      heading: 'Create your free personal account',
      subheading:
        'Your personal hub is free forever. After signup you can add a business, family, or community workspace — or explore personal-only first.',
      badge: 'Free forever · no card to start',
      highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
      intent: null,
    };
  }

  // Empty setup path = personal-only intent from /start
  if (
    !intent.profile &&
    !intent.productId &&
    !intent.planId
  ) {
    return {
      heading: 'Create your free personal account',
      subheading:
        'No workspace required yet — start with personal tasks, people, notes, and planner. Add Solo, Team, or family when you need them.',
      badge: 'Personal free · workspaces optional',
      highlights: [
        'Free personal account — always yours',
        'People, notes, tasks & planner included',
        'Add a business workspace anytime',
      ],
      intent,
    };
  }

  const product = intent.productId
    ? getBillingProductPrice(intent.productId)
    : null;

  if (
    intent.productId === 'ozer-business-lite' ||
    intent.planId === 'business-lite-free'
  ) {
    return {
      heading: 'Create your free personal account',
      subheading:
        'Your personal hub comes first. Next you’ll add a free Business Lite workspace to install apps like Signatures.',
      badge: 'Free personal + Lite · no card',
      highlights: [
        'Free personal tasks, people, notes & planner',
        'Business Lite workspace for apps like Signatures',
        'Upgrade to Solo or Team when you need CRM',
      ],
      intent,
    };
  }

  if (isPaidBusinessProduct(intent.productId) && product) {
    const isTeam =
      intent.productId === 'ozer-business-team' ||
      intent.productId === 'ozer-business-scale';
    const planName = product.productName;
    const intervalLabel = intent.interval === 'year' ? 'year' : 'month';

    return {
      heading: 'Create your free personal account',
      subheading: isTeam
        ? `Ozer starts with your personal hub. After signup, add a ${planName} workspace for the studio — 14-day trial, then £${product.monthlyPriceGbp}/${intervalLabel}.`
        : `Ozer starts with your personal hub. After signup, add ${planName} for clients, projects, and invoices — 14-day trial, then £${product.monthlyPriceGbp}/${intervalLabel}.`,
      badge: 'Personal free · 14-day trial, no card',
      highlights: [
        'Free personal account — always yours',
        ...productHighlights(intent.productId, [
          `${planName} workspace for the studio`,
          'Flat price — no per-seat maths',
        ]).slice(0, 2),
      ],
      intent,
    };
  }

  if (product && product.monthlyPriceGbp > 0) {
    const intervalLabel = intent.interval === 'year' ? 'year' : 'month';
    return {
      heading: 'Create your free personal account',
      subheading: `Your personal hub comes first. After signup you’ll set up ${product.productName} (14-day trial, then £${product.monthlyPriceGbp}/${intervalLabel}).`,
      badge: 'Personal free · trial on paid plans',
      highlights: productHighlights(intent.productId, [
        ...PERSONAL_FIRST_HIGHLIGHTS,
      ]),
      intent,
    };
  }

  if (intent.profile === 'family' || intent.profile === 'community') {
    const label = PROFILE_LABEL[intent.profile];
    return {
      heading: 'Create your free personal account',
      subheading: `Your personal hub is included. Next you’ll add a ${label} workspace. ${MARKETING_FREE_TIER.description}`,
      badge: 'No credit card',
      highlights: [...MARKETING_FREE_TIER.features],
      intent,
    };
  }

  if (intent.profile === 'work_design' || intent.profile === 'work_property') {
    return {
      heading: 'Create your free personal account',
      subheading:
        'Ozer starts with you. After signup, add a business workspace — most freelancers pick Solo; small studios pick Team.',
      badge: 'Free personal · business when ready',
      highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
      intent,
    };
  }

  return {
    heading: 'Create your free personal account',
    subheading:
      'After you sign up, add workspaces for business, family, or community. Most studios start with Business Solo or Team.',
    badge: 'Free to start',
    highlights: [...PERSONAL_FIRST_HIGHLIGHTS],
    intent,
  };
}

export function buildAuthLinkWithNext(basePath: string, next: string | undefined) {
  if (!next?.trim()) return basePath;
  const safe = getSafeRedirectPath(next, pathsConfig.app.home);
  return `${basePath}?next=${encodeURIComponent(safe)}`;
}
