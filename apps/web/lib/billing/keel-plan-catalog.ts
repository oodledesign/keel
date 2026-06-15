import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import { KEEL_STRIPE_PRICES } from './stripe-price-ids';

export type KeelPlanFamily =
  | 'community'
  | 'business'
  | 'business_lite'
  | 'property'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos'
  | 'addon_signatures'
  | 'addon_email_assistant';

export type KeelPlanLimits = {
  maxMembers: number | null;
  maxProperties: number | null;
  maxVideos: number | null;
};

export type KeelPlanDefinition = {
  productId: string;
  planId: string;
  stripePriceId: string;
  family: KeelPlanFamily;
  entitlementKey: string;
  limits: KeelPlanLimits;
  workspaceProfiles?: WorkspaceProfile[];
};

const COMMUNITY: KeelPlanDefinition[] = [
  {
    productId: 'keel-community',
    planId: 'community-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.community_monthly,
    family: 'community',
    entitlementKey: 'workspace_community',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['community'],
  },
  {
    productId: 'keel-community',
    planId: 'community-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.community_yearly,
    family: 'community',
    entitlementKey: 'workspace_community',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['community'],
  },
];

const BUSINESS_LITE: KeelPlanDefinition[] = [
  {
    productId: 'keel-business-lite',
    planId: 'business-lite-free',
    stripePriceId: KEEL_STRIPE_PRICES.business_lite_monthly,
    family: 'business_lite',
    entitlementKey: 'workspace_business_lite',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
];

const BUSINESS: KeelPlanDefinition[] = [
  {
    productId: 'keel-business-solo',
    planId: 'business-solo-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.business_solo_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 1, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'keel-business-solo',
    planId: 'business-solo-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.business_solo_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 1, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'keel-business-team',
    planId: 'business-team-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.business_team_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 5, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'keel-business-team',
    planId: 'business-team-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.business_team_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 5, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'keel-business-scale',
    planId: 'business-scale-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.business_scale_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 15, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'keel-business-scale',
    planId: 'business-scale-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.business_scale_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 15, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
];

const PROPERTY: KeelPlanDefinition[] = [
  {
    productId: 'keel-property-starter',
    planId: 'property-starter-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.property_starter_monthly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 5, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'keel-property-starter',
    planId: 'property-starter-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.property_starter_yearly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 5, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'keel-property-portfolio',
    planId: 'property-portfolio-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.property_portfolio_monthly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 20, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'keel-property-portfolio',
    planId: 'property-portfolio-yearly',
    stripePriceId: KEEL_STRIPE_PRICES.property_portfolio_yearly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 20, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
];

const ADDONS: KeelPlanDefinition[] = [
  {
    productId: 'keel-addon-signatures',
    planId: 'signatures-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_signatures_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'keel-addon-rankly',
    planId: 'rankly-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_rankly_monthly,
    family: 'addon_rankly',
    entitlementKey: 'addon_rankly',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'keel-addon-feedflow',
    planId: 'feedflow-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_feedflow_monthly,
    family: 'addon_feedflow',
    entitlementKey: 'addon_feedflow',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'keel-addon-videos-starter',
    planId: 'videos-starter-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_videos_starter_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 5 },
  },
  {
    productId: 'keel-addon-videos-growth',
    planId: 'videos-growth-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_videos_growth_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 20 },
  },
  {
    productId: 'keel-addon-videos-pro',
    planId: 'videos-pro-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_videos_pro_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 49 },
  },
  {
    productId: 'keel-addon-videos-studio',
    planId: 'videos-studio-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_videos_studio_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 100 },
  },
  {
    productId: 'keel-addon-email-assistant',
    planId: 'email-assistant-monthly',
    stripePriceId: KEEL_STRIPE_PRICES.addon_email_assistant_monthly,
    family: 'addon_email_assistant',
    entitlementKey: 'addon_email_assistant',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
];

export const KEEL_PLAN_CATALOG: KeelPlanDefinition[] = [
  ...COMMUNITY,
  ...BUSINESS_LITE,
  ...BUSINESS,
  ...PROPERTY,
  ...ADDONS,
];

export function findPlanByStripePriceId(
  variantId: string,
): KeelPlanDefinition | undefined {
  return KEEL_PLAN_CATALOG.find((plan) => plan.stripePriceId === variantId);
}

export function findPlanByProductAndPlanId(
  productId: string,
  planId: string,
): KeelPlanDefinition | undefined {
  return KEEL_PLAN_CATALOG.find(
    (plan) => plan.productId === productId && plan.planId === planId,
  );
}

export function requiredEntitlementForProfile(
  profile: WorkspaceProfile,
): string | null {
  switch (profile) {
    case 'family':
      return null;
    case 'community':
      return 'workspace_community';
    case 'work_design':
      return 'workspace_business';
    case 'work_property':
      return 'workspace_property';
    default:
      return null;
  }
}

export function catalogPlansForWorkspaceProfile(
  profile: WorkspaceProfile,
): KeelPlanDefinition[] {
  return KEEL_PLAN_CATALOG.filter(
    (plan) =>
      plan.workspaceProfiles?.includes(profile) &&
      !plan.productId.startsWith('keel-addon') &&
      plan.family !== 'business_lite',
  );
}

export function productIdsForWorkspaceProfile(
  profile: WorkspaceProfile,
): string[] {
  const ids = new Set<string>();
  for (const plan of catalogPlansForWorkspaceProfile(profile)) {
    ids.add(plan.productId);
  }
  return [...ids];
}

export function addonProductIds(): string[] {
  const ids = new Set<string>();
  for (const plan of KEEL_PLAN_CATALOG) {
    if (plan.productId.startsWith('keel-addon')) {
      ids.add(plan.productId);
    }
  }
  return [...ids];
}

export function catalogPlansForAddonProduct(productId: string): KeelPlanDefinition[] {
  return KEEL_PLAN_CATALOG.filter((plan) => plan.productId === productId);
}

export type KeelAddonKey =
  | 'addon_signatures'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos';

/** Personal-account add-ons (entitlement on the user's personal account id). */
export type KeelPersonalAddonKey = 'addon_email_assistant';

export const EMAIL_ASSISTANT_ENTITLEMENT: KeelPersonalAddonKey =
  'addon_email_assistant';

export const KEEL_PERSONAL_ADDON_CATALOG: Array<{
  key: KeelPersonalAddonKey;
  productId: string;
  planId: string;
  name: string;
  description: string;
  monthlyPriceGbp: number;
}> = [
  {
    key: 'addon_email_assistant',
    productId: 'keel-addon-email-assistant',
    planId: 'email-assistant-monthly',
    name: 'Email Assistant',
    description:
      'Gmail inbox sync, AI action items, and draft replies in your personal Keel.',
    monthlyPriceGbp: 12,
  },
];

export const KEEL_ADDON_CATALOG: Array<{
  key: KeelAddonKey;
  productId: string;
  name: string;
  description: string;
  fromPriceGbp: number;
}> = [
  {
    key: 'addon_signatures',
    productId: 'keel-addon-signatures',
    name: 'Signatures',
    description: 'Branded email signatures with Microsoft 365 and Google Workspace.',
    fromPriceGbp: 9,
  },
  {
    key: 'addon_rankly',
    productId: 'keel-addon-rankly',
    name: 'Rankly',
    description:
      'SEO rankings, scheduled PageSpeed Insights, AI audits, and content briefs. Backlinks coming soon.',
    fromPriceGbp: 36,
  },
  {
    key: 'addon_feedflow',
    productId: 'keel-addon-feedflow',
    name: 'Feedflow',
    description: 'Review widgets and social publishing for your brand.',
    fromPriceGbp: 9,
  },
  {
    key: 'addon_videos',
    productId: 'keel-addon-videos-starter',
    name: 'Videos',
    description:
      'Hosted video with private/public controls, public links, branded players, and embeds for Webflow, WordPress & more.',
    fromPriceGbp: 5,
  },
];
