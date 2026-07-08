import {
  formatGbp as formatGbpFromConfig,
  getBillingProductPrice,
  listAllWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import pathsConfig from '~/config/paths.config';

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
  'ozer-business-solo': 'work_design',
  'ozer-business-team': 'work_design',
  'ozer-business-scale': 'work_design',
  'ozer-property-starter': 'work_property',
  'ozer-property-portfolio': 'work_property',
};

export const MARKETING_FREE_TIER = {
  name: 'Personal & Family',
  description: 'Your personal command centre plus one family workspace.',
  features: [
    'Personal tasks, planner & pipeline',
    'One family workspace included',
    'No credit card required',
  ],
} as const;

/** Derived from apps/web/config/billing.config.ts — do not hardcode costs here. */
export const MARKETING_WORKSPACE_PLANS: MarketingWorkspacePlan[] =
  listAllWorkspacePrices().map((plan) => ({
    productId: plan.productId,
    monthlyPlanId: plan.monthlyPlanId ?? `${plan.productId}-monthly`,
    yearlyPlanId: plan.yearlyPlanId ?? plan.monthlyPlanId ?? `${plan.productId}-yearly`,
    profile: PRODUCT_PROFILE[plan.productId] ?? 'work_design',
    name: plan.productName,
    description: plan.description,
    monthlyPriceGbp: plan.monthlyPriceGbp,
    yearlyPriceGbp: plan.yearlyPriceGbp ?? plan.monthlyPriceGbp * 12,
    features: plan.features,
    maxTeamMembers: plan.maxTeamMembers,
    highlighted: plan.highlighted,
    badge: plan.badge,
  }));

const ADDON_PRODUCT_IDS = [
  'ozer-addon-signatures',
] as const;

const PRODUCT_URL_ALIASES = {
  'ozer-business-lite': 'business-lite',
  'ozer-business-solo': 'business-solo',
  'ozer-business-team': 'business-team',
  'ozer-business-scale': 'business-scale',
  'ozer-addon-signatures': 'signatures',
} as const;

const PRODUCT_ID_BY_URL_ALIAS = new Map(
  Object.entries(PRODUCT_URL_ALIASES).map(([productId, alias]) => [
    alias,
    productId,
  ]),
);

/** Derived from billing.config.ts. */
export const MARKETING_ADDON_PLANS: MarketingAddonPlan[] = ADDON_PRODUCT_IDS.map(
  (productId) => {
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
  },
);

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
}) {
  const search = new URLSearchParams();
  if (params.profile) search.set('profile', params.profile);
  if (params.productId) {
    search.set('product', publicProductSlug(params.productId));
  }
  if (params.planId) search.set('plan', params.planId);
  if (params.interval) search.set('interval', params.interval);

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
}) {
  const setupPath = buildSetupPath(params);
  const next = encodeURIComponent(setupPath);
  return `${pathsConfig.auth.signUp}?next=${next}`;
}

/**
 * Default marketing "Start free": personal account first, then recommend
 * Business Solo (the freelancers / small-studio path we want people on).
 */
export const MARKETING_FREE_SIGNUP_URL = buildPricingSignupUrl({
  profile: 'work_design',
  productId: 'ozer-business-solo',
  planId: 'business-solo-monthly',
  interval: 'month',
});

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
}) {
  const path = pathsConfig.app.accountBilling.replace('[account]', params.accountSlug);
  const search = new URLSearchParams({
    product: params.productId,
    plan: params.planId,
  });
  if (params.interval) search.set('interval', params.interval);
  if (params.setup) search.set('setup', '1');
  return `${path}?${search.toString()}`;
}

export type SetupIntent = {
  profile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  interval: BillingInterval;
};

export type WorkspaceSetupBillingIntent = {
  productId: string;
  planId: string;
  interval?: BillingInterval;
};

export function parseSetupIntent(searchParams: URLSearchParams): SetupIntent {
  const profile = searchParams.get('profile') as WorkspaceProfile | null;
  const productId = internalProductId(searchParams.get('product'));
  const planId = searchParams.get('plan')?.trim() || undefined;
  const intervalRaw = searchParams.get('interval');
  const interval: BillingInterval =
    intervalRaw === 'year' ? 'year' : 'month';

  return {
    profile:
      profile === 'community' ||
      profile === 'family' ||
      profile === 'work_design' ||
      profile === 'work_property'
        ? profile
        : undefined,
    productId,
    planId,
    interval,
  };
}

export function publicProductSlug(productId: string) {
  return PRODUCT_URL_ALIASES[
    productId as keyof typeof PRODUCT_URL_ALIASES
  ] ?? productId;
}

export function internalProductId(product: string | null | undefined) {
  const value = product?.trim();
  if (!value) return undefined;

  return PRODUCT_ID_BY_URL_ALIAS.get(value) ?? value;
}
