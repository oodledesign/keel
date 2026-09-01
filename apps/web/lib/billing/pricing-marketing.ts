import pathsConfig from '~/config/paths.config';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import {
  formatGbp as formatGbpFromConfig,
  getBillingProductPrice,
  listAllWorkspacePrices,
} from '~/lib/billing/billing-config-prices';

export type BillingInterval = 'month' | 'year';

export type MarketingWorkspacePlan = {
  productId: string;
  monthlyPlanId: string;
  yearlyPlanId: string;
  profile: WorkspaceProfile;
  name: string;
  description: string;
  monthlyPriceGbp: number;
  yearlyPriceGbp: number;
  features: string[];
  maxTeamMembers: number | null;
  highlighted?: boolean;
  badge?: string;
};

export type MarketingAddonPlan = {
  productId: string;
  planId: string;
  name: string;
  description: string;
  monthlyPriceGbp: number;
  features: string[];
};

const PRODUCT_PROFILE: Record<string, WorkspaceProfile> = {
  'ozer-community': 'community',
  'ozer-business-lite': 'work_design',
  'ozer-business-starter': 'work_design',
  'ozer-business': 'work_design',
  'ozer-property-starter': 'work_property',
  'ozer-property-portfolio': 'work_property',
  'ozer-commercial-property': 'commercial_property',
};

export const MARKETING_FREE_TIER = {
  name: 'Personal',
  description:
    'Your personal command centre — tasks, people, notes, and planner in one place.',
  features: [
    'Personal tasks & planner',
    'People — personal CRM for friends and family',
    'Notes',
    'No credit card required',
  ],
} as const;

/** Derived from apps/web/config/billing.config.ts — do not hardcode costs here. */
export const MARKETING_WORKSPACE_PLANS: MarketingWorkspacePlan[] =
  listAllWorkspacePrices().map((plan) => ({
    productId: plan.productId,
    monthlyPlanId: plan.monthlyPlanId ?? `${plan.productId}-monthly`,
    yearlyPlanId:
      plan.yearlyPlanId ?? plan.monthlyPlanId ?? `${plan.productId}-yearly`,
    profile: PRODUCT_PROFILE[plan.productId] ?? 'work_design',
    name: plan.productName,
    description: plan.description,
    monthlyPriceGbp: plan.monthlyPriceGbp,
    yearlyPriceGbp:
      plan.yearlyPriceGbp ??
      (plan.productId === 'ozer-business-starter' ||
      plan.productId === 'ozer-business'
        ? plan.monthlyPriceGbp * 10
        : plan.monthlyPriceGbp * 12),
    features: plan.features,
    maxTeamMembers: plan.maxTeamMembers,
    highlighted: plan.highlighted,
    badge: plan.badge,
  }));

const ADDON_PRODUCT_IDS = [
  'ozer-addon-signatures',
  'ozer-addon-site-studio',
  'ozer-addon-media-starter',
] as const;

const PRODUCT_URL_ALIASES = {
  'ozer-business-lite': 'business-lite',
  'ozer-business-starter': 'business-starter',
  'ozer-business': 'business',
  'ozer-addon-signatures': 'signatures',
  'ozer-addon-site-studio': 'site-studio',
  'ozer-addon-media-starter': 'media-generate',
} as const;

const PRODUCT_ID_BY_URL_ALIAS = new Map<string, string>([
  ...Object.entries(PRODUCT_URL_ALIASES).map(
    ([productId, alias]) => [alias, productId] as const,
  ),
  ['starter', 'ozer-business-starter'],
  // Legacy Solo/Team/Scale URL aliases → Pro
  ['business-solo', 'ozer-business'],
  ['business-team', 'ozer-business'],
  ['business-scale', 'ozer-business'],
]);

/** Derived from billing.config.ts. */
export const MARKETING_ADDON_PLANS: MarketingAddonPlan[] =
  ADDON_PRODUCT_IDS.map((productId) => {
    const plan = getBillingProductPrice(productId);
    if (!plan) {
      throw new Error(`Missing billing product ${productId}`);
    }
    return {
      productId,
      planId: plan.monthlyPlanId ?? `${productId}-monthly`,
      name: plan.productName,
      description: plan.description,
      monthlyPriceGbp: plan.monthlyPriceGbp,
      features: plan.features,
    };
  });

export function planIdForInterval(
  plan: MarketingWorkspacePlan,
  interval: BillingInterval,
) {
  return interval === 'year' ? plan.yearlyPlanId : plan.monthlyPlanId;
}

export function formatGbp(amount: number) {
  return formatGbpFromConfig(amount);
}

export function addonPriceFromBilling(productId: string, planId: string) {
  const product = getBillingProductPrice(productId);
  if (!product) return null;
  return {
    productId,
    planId: product.monthlyPlanId ?? planId,
    name: product.productName,
    description: product.description,
    monthlyPriceGbp: product.monthlyPriceGbp,
    features: product.features,
  } satisfies MarketingAddonPlan;
}

export function buildSetupPath(params: {
  profile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  interval?: BillingInterval;
  seats?: number;
}) {
  const search = new URLSearchParams();
  if (params.profile) search.set('profile', params.profile);
  if (params.productId) {
    search.set('product', publicProductSlug(params.productId));
  }
  if (params.planId) search.set('plan', params.planId);
  if (params.interval) search.set('interval', params.interval);
  if (params.seats != null && params.seats >= 1) {
    search.set('seats', String(Math.floor(params.seats)));
  }

  const query = search.toString();
  return query
    ? `${pathsConfig.app.workspaceSetup}?${query}`
    : pathsConfig.app.workspaceSetup;
}

/** Sign up, then land on workspace setup with the chosen plan pre-selected. */
export function buildPricingSignupUrl(params: {
  profile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  interval?: BillingInterval;
  seats?: number;
}) {
  const setupPath = buildSetupPath(params);
  const next = encodeURIComponent(setupPath);
  return `${pathsConfig.auth.signUp}?next=${next}`;
}

/**
 * Default marketing "Start free": chooser that makes personal-first obvious,
 * then optional workspace (Free / Starter / Pro / family / community).
 */
export const MARKETING_FREE_SIGNUP_URL = '/start';

/** Apps / Signatures surfaces that specifically push free Business Lite. */
export const MARKETING_BUSINESS_LITE_SIGNUP_URL = buildPricingSignupUrl({
  profile: 'work_design',
  productId: 'ozer-business-lite',
  planId: 'business-lite-free',
});

export function buildSignedInBillingUrl(params: {
  accountSlug: string;
  productId: string;
  planId: string;
  interval?: BillingInterval;
  setup?: boolean;
  seats?: number;
}) {
  const path = pathsConfig.app.accountBilling.replace(
    '[account]',
    params.accountSlug,
  );
  const search = new URLSearchParams({
    product: params.productId,
    plan: params.planId,
  });
  if (params.interval) search.set('interval', params.interval);
  if (params.setup) search.set('setup', '1');
  if (params.seats != null && params.seats >= 1) {
    search.set('seats', String(Math.floor(params.seats)));
  }
  return `${path}?${search.toString()}`;
}

export type SetupIntent = {
  profile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  interval: BillingInterval;
  seats?: number;
};

export type WorkspaceSetupBillingIntent = {
  productId: string;
  planId: string;
  interval?: BillingInterval;
  seats?: number;
};

export function parseSetupIntent(searchParams: URLSearchParams): SetupIntent {
  const profile = searchParams.get('profile') as WorkspaceProfile | null;
  const productId = internalProductId(searchParams.get('product'));
  const planId = searchParams.get('plan')?.trim() || undefined;
  const intervalRaw = searchParams.get('interval');
  const interval: BillingInterval = intervalRaw === 'year' ? 'year' : 'month';
  const seatsRaw = Number(searchParams.get('seats'));
  const seats =
    Number.isFinite(seatsRaw) && seatsRaw >= 1
      ? Math.min(200, Math.floor(seatsRaw))
      : undefined;

  return {
    profile:
      profile === 'community' ||
      profile === 'family' ||
      profile === 'work_design' ||
      profile === 'work_property' ||
      profile === 'commercial_property' ||
      profile === 'building_surveyor'
        ? profile
        : undefined,
    productId,
    planId,
    interval,
    seats,
  };
}

export function publicProductSlug(productId: string) {
  return (
    PRODUCT_URL_ALIASES[productId as keyof typeof PRODUCT_URL_ALIASES] ??
    productId
  );
}

export function internalProductId(product: string | null | undefined) {
  const value = product?.trim();
  if (!value) return undefined;

  return PRODUCT_ID_BY_URL_ALIAS.get(value) ?? value;
}
