import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import pathsConfig from '~/config/paths.config';
import { getSafeRedirectPath } from '@kit/shared/utils';

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

export const MARKETING_FREE_TIER = {
  name: 'Personal & Family',
  description: 'Your personal command centre plus one family workspace.',
  features: [
    'Personal tasks, planner & pipeline',
    'One family workspace included',
    'No card required',
  ],
} as const;

export const MARKETING_WORKSPACE_PLANS: MarketingWorkspacePlan[] = [
  {
    productId: 'keel-community',
    monthlyPlanId: 'community-monthly',
    yearlyPlanId: 'community-yearly',
    profile: 'community',
    name: 'Community',
    description: 'Clubs, homegroups, and small communities.',
    monthlyPriceGbp: 12,
    yearlyPriceGbp: 120,
    features: ['Shared schedule & events', 'Group tasks & notes', '3 members included'],
  },
  {
    productId: 'keel-business-solo',
    monthlyPlanId: 'business-solo-monthly',
    yearlyPlanId: 'business-solo-yearly',
    profile: 'work_design',
    name: 'Business Solo',
    description: 'Full business workspace for one person.',
    monthlyPriceGbp: 29,
    yearlyPriceGbp: 290,
    features: ['Clients, jobs, invoices & tasks', '1 team member', 'Docs, finances & pipeline'],
  },
  {
    productId: 'keel-business-team',
    monthlyPlanId: 'business-team-monthly',
    yearlyPlanId: 'business-team-yearly',
    profile: 'work_design',
    name: 'Business Team',
    description: 'Small agencies and teams.',
    monthlyPriceGbp: 79,
    yearlyPriceGbp: 790,
    features: ['Everything in Solo', 'Up to 5 team members', 'Shared client work'],
    highlighted: true,
    badge: 'Popular',
  },
  {
    productId: 'keel-business-scale',
    monthlyPlanId: 'business-scale-monthly',
    yearlyPlanId: 'business-scale-yearly',
    profile: 'work_design',
    name: 'Business Scale',
    description: 'Larger teams with more seats.',
    monthlyPriceGbp: 149,
    yearlyPriceGbp: 1490,
    features: ['Everything in Team', 'Up to 15 team members', 'Priority support'],
  },
  {
    productId: 'keel-property-starter',
    monthlyPlanId: 'property-starter-monthly',
    yearlyPlanId: 'property-starter-yearly',
    profile: 'work_property',
    name: 'Property Starter',
    description: 'Landlords and small portfolios.',
    monthlyPriceGbp: 19,
    yearlyPriceGbp: 190,
    features: ['Up to 5 properties', 'Tenants & maintenance', 'Property finances'],
  },
  {
    productId: 'keel-property-portfolio',
    monthlyPlanId: 'property-portfolio-monthly',
    yearlyPlanId: 'property-portfolio-yearly',
    profile: 'work_property',
    name: 'Property Portfolio',
    description: 'Property managers with larger portfolios.',
    monthlyPriceGbp: 29,
    yearlyPriceGbp: 290,
    features: ['Up to 20 properties', 'Bulk workflows', 'Portfolio reporting'],
  },
];

export const MARKETING_ADDON_PLANS: MarketingAddonPlan[] = [
  {
    productId: 'keel-addon-rankly',
    planId: 'rankly-monthly',
    name: 'Rankly',
    description: 'SEO suite per workspace.',
    monthlyPriceGbp: 36,
    features: ['Rank tracking', 'PageSpeed scans', 'Site explorer & briefs'],
  },
  {
    productId: 'keel-addon-feedflow',
    planId: 'feedflow-monthly',
    name: 'Feedflow',
    description: 'Reviews and social per workspace.',
    monthlyPriceGbp: 9,
    features: ['Review widgets', 'Social accounts', 'Video snippets'],
  },
  {
    productId: 'keel-addon-videos-starter',
    planId: 'videos-starter-monthly',
    name: 'Videos Starter',
    description: 'Up to 5 hosted videos.',
    monthlyPriceGbp: 5,
    features: ['Embeds & presets', 'Per workspace'],
  },
  {
    productId: 'keel-addon-videos-growth',
    planId: 'videos-growth-monthly',
    name: 'Videos Growth',
    description: 'Up to 20 hosted videos.',
    monthlyPriceGbp: 12,
    features: ['Analytics & presets', 'Per workspace'],
  },
  {
    productId: 'keel-addon-videos-pro',
    planId: 'videos-pro-monthly',
    name: 'Videos Pro',
    description: 'Up to 49 hosted videos.',
    monthlyPriceGbp: 29,
    features: ['Custom presets & branding', 'Per workspace'],
  },
  {
    productId: 'keel-addon-videos-studio',
    planId: 'videos-studio-monthly',
    name: 'Videos Studio',
    description: 'Up to 100 hosted videos.',
    monthlyPriceGbp: 47,
    features: ['Priority encoding', 'Per workspace'],
  },
];

export function planIdForInterval(
  plan: MarketingWorkspacePlan,
  interval: BillingInterval,
) {
  return interval === 'year' ? plan.yearlyPlanId : plan.monthlyPlanId;
}

export function formatGbp(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildSetupPath(params: {
  profile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  interval?: BillingInterval;
}) {
  const search = new URLSearchParams();
  if (params.profile) search.set('profile', params.profile);
  if (params.productId) search.set('product', params.productId);
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
  const productId = searchParams.get('product')?.trim() || undefined;
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

export function safeNextPath(next: string | undefined) {
  return getSafeRedirectPath(next, pathsConfig.app.workspaceSetup);
}
