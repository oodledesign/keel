import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export type OzerPlanFamily =
  | 'community'
  | 'business'
  | 'business_lite'
  | 'property'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos'
  | 'addon_signatures'
  | 'addon_email_assistant';

export type OzerPlanLimits = {
  maxMembers: number | null;
  maxProperties: number | null;
  maxVideos: number | null;
  maxMailboxes?: number | null;
};

export type OzerPlanDefinition = {
  productId: string;
  planId: string;
  stripePriceId: string;
  family: OzerPlanFamily;
  entitlementKey: string;
  limits: OzerPlanLimits;
  workspaceProfiles?: WorkspaceProfile[];
};

const COMMUNITY: OzerPlanDefinition[] = [
  {
    productId: 'ozer-community',
    planId: 'community-monthly',
    stripePriceId: OZER_STRIPE_PRICES.community_monthly,
    family: 'community',
    entitlementKey: 'workspace_community',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['community'],
  },
  {
    productId: 'ozer-community',
    planId: 'community-yearly',
    stripePriceId: OZER_STRIPE_PRICES.community_yearly,
    family: 'community',
    entitlementKey: 'workspace_community',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['community'],
  },
];

const BUSINESS_LITE: OzerPlanDefinition[] = [
  {
    productId: 'ozer-business-lite',
    planId: 'business-lite-free',
    stripePriceId: OZER_STRIPE_PRICES.business_lite_monthly,
    family: 'business_lite',
    entitlementKey: 'workspace_business_lite',
    limits: { maxMembers: 3, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
];

const BUSINESS: OzerPlanDefinition[] = [
  {
    productId: 'ozer-business-solo',
    planId: 'business-solo-monthly',
    stripePriceId: OZER_STRIPE_PRICES.business_solo_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 1, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business-solo',
    planId: 'business-solo-yearly',
    stripePriceId: OZER_STRIPE_PRICES.business_solo_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 1, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business-team',
    planId: 'business-team-monthly',
    stripePriceId: OZER_STRIPE_PRICES.business_team_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 5, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business-team',
    planId: 'business-team-yearly',
    stripePriceId: OZER_STRIPE_PRICES.business_team_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 5, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business-scale',
    planId: 'business-scale-monthly',
    stripePriceId: OZER_STRIPE_PRICES.business_scale_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 15, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business-scale',
    planId: 'business-scale-yearly',
    stripePriceId: OZER_STRIPE_PRICES.business_scale_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: { maxMembers: 15, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['work_design'],
  },
];

const PROPERTY: OzerPlanDefinition[] = [
  {
    productId: 'ozer-property-starter',
    planId: 'property-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.property_starter_monthly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 5, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'ozer-property-starter',
    planId: 'property-starter-yearly',
    stripePriceId: OZER_STRIPE_PRICES.property_starter_yearly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 5, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'ozer-property-portfolio',
    planId: 'property-portfolio-monthly',
    stripePriceId: OZER_STRIPE_PRICES.property_portfolio_monthly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 20, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
  {
    productId: 'ozer-property-portfolio',
    planId: 'property-portfolio-yearly',
    stripePriceId: OZER_STRIPE_PRICES.property_portfolio_yearly,
    family: 'property',
    entitlementKey: 'workspace_property',
    limits: { maxMembers: null, maxProperties: 20, maxVideos: null },
    workspaceProfiles: ['work_property'],
  },
];

const ADDONS: OzerPlanDefinition[] = [
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_starter_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 10 },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_starter_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 10 },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-team-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_team_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 50 },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-team-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_team_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 50 },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-office-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_office_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 150 },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-office-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_office_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null, maxMailboxes: 150 },
  },
  {
    productId: 'ozer-addon-rankly',
    planId: 'rankly-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_rankly_monthly,
    family: 'addon_rankly',
    entitlementKey: 'addon_rankly',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-feedflow',
    planId: 'feedflow-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_feedflow_monthly,
    family: 'addon_feedflow',
    entitlementKey: 'addon_feedflow',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-videos-starter',
    planId: 'videos-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_videos_starter_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 5 },
  },
  {
    productId: 'ozer-addon-videos-growth',
    planId: 'videos-growth-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_videos_growth_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 20 },
  },
  {
    productId: 'ozer-addon-videos-pro',
    planId: 'videos-pro-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_videos_pro_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 49 },
  },
  {
    productId: 'ozer-addon-videos-studio',
    planId: 'videos-studio-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_videos_studio_monthly,
    family: 'addon_videos',
    entitlementKey: 'addon_videos',
    limits: { maxMembers: null, maxProperties: null, maxVideos: 100 },
  },
  {
    productId: 'ozer-addon-email-assistant',
    planId: 'email-assistant-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_email_assistant_monthly,
    family: 'addon_email_assistant',
    entitlementKey: 'addon_email_assistant',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
];

export const OZER_PLAN_CATALOG: OzerPlanDefinition[] = [
  ...COMMUNITY,
  ...BUSINESS_LITE,
  ...BUSINESS,
  ...PROPERTY,
  ...ADDONS,
];

export function findPlanByStripePriceId(
  variantId: string,
): OzerPlanDefinition | undefined {
  return OZER_PLAN_CATALOG.find((plan) => plan.stripePriceId === variantId);
}

export function findPlanByProductAndPlanId(
  productId: string,
  planId: string,
): OzerPlanDefinition | undefined {
  return OZER_PLAN_CATALOG.find(
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
): OzerPlanDefinition[] {
  return OZER_PLAN_CATALOG.filter(
    (plan) =>
      plan.workspaceProfiles?.includes(profile) &&
      !plan.productId.startsWith('ozer-addon') &&
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
  for (const plan of OZER_PLAN_CATALOG) {
    if (plan.productId.startsWith('ozer-addon')) {
      ids.add(plan.productId);
    }
  }
  return [...ids];
}

export function catalogPlansForAddonProduct(productId: string): OzerPlanDefinition[] {
  return OZER_PLAN_CATALOG.filter((plan) => plan.productId === productId);
}

export type OzerAddonKey =
  | 'addon_signatures'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos';

/** Personal-account add-ons (entitlement on the user's personal account id). */
export type OzerPersonalAddonKey = 'addon_email_assistant';

export const EMAIL_ASSISTANT_ENTITLEMENT: OzerPersonalAddonKey =
  'addon_email_assistant';

export const OZER_PERSONAL_ADDON_CATALOG: Array<{
  key: OzerPersonalAddonKey;
  productId: string;
  planId: string;
  name: string;
  description: string;
  monthlyPriceGbp: number;
}> = [
  {
    key: 'addon_email_assistant',
    productId: 'ozer-addon-email-assistant',
    planId: 'email-assistant-monthly',
    name: 'Email Assistant',
    description:
      'Gmail inbox sync, AI action items, and draft replies in your personal Ozer.',
    monthlyPriceGbp: 9,
  },
];

export const OZER_ADDON_CATALOG: Array<{
  key: OzerAddonKey;
  productId: string;
  name: string;
  description: string;
  fromPriceGbp: number;
}> = [
  {
    key: 'addon_signatures',
    productId: 'ozer-addon-signatures',
    name: 'Signatures',
    description:
      'Flat tiers for branded email signatures with Microsoft 365 and Google Workspace.',
    fromPriceGbp: 9,
  },
  {
    key: 'addon_rankly',
    productId: 'ozer-addon-rankly',
    name: 'Rankly',
    description:
      'SEO rankings, scheduled PageSpeed Insights, AI audits, and content briefs. Backlinks coming soon.',
    fromPriceGbp: 36,
  },
  {
    key: 'addon_feedflow',
    productId: 'ozer-addon-feedflow',
    name: 'Feedflow',
    description: 'Review widgets and social publishing for your brand.',
    fromPriceGbp: 9,
  },
  {
    key: 'addon_videos',
    productId: 'ozer-addon-videos-starter',
    name: 'Videos',
    description:
      'Hosted video with private/public controls, public links, branded players, and embeds for Webflow, WordPress & more.',
    fromPriceGbp: 5,
  },
];
