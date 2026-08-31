import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';

import { OZER_STRIPE_PRICES } from './stripe-price-ids';

export type OzerPlanFamily =
  | 'community'
  | 'business'
  | 'business_lite'
  | 'business_starter'
  | 'property'
  | 'commercial_property'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos'
  | 'addon_signatures'
  | 'addon_site_studio'
  | 'addon_email_assistant'
  | 'addon_portal_publishing'
  | 'addon_media_generate'
  | 'addon_campaigns';

export type OzerPlanLimits = {
  maxMembers: number | null;
  maxProperties: number | null;
  maxVideos: number | null;
  maxMailboxes?: number | null;
  /** NULL = unlimited / not enforced. Free sets 1. */
  maxProjectGuests?: number | null;
  /** Campaigns add-on: billed mailing-list size. */
  maxContacts?: number | null;
  /** Campaigns add-on: monthly email-send units. */
  maxEmails?: number | null;
  /** NULL = unlimited / not enforced (same as other max_* caps). */
  maxActiveClients?: number | null;
  maxInvoicesPerMonth?: number | null;
  maxOpenTasks?: number | null;
  maxBookingsPerMonth?: number | null;
  maxPortalStorageBytes?: number | null;
  /**
   * Unused for platform pricing. Businesses manage their own client-request
   * library — this is not an Ozer-billed monthly pile.
   * NULL means unset / not sold. Do not invent marketing numbers.
   */
  clientRequestCreditAllowance?: number | null;
  meetingCoachingEnabled?: boolean;
};

/** Binary MiB/GiB — matches existing `N * 1024 * 1024` storage limits in the app. */
export const PORTAL_STORAGE_BYTES = {
  /** 250 MiB */
  free: 250 * 1024 * 1024,
  /** 10 GiB */
  starter: 10 * 1024 * 1024 * 1024,
  /** 25 GiB */
  pro: 25 * 1024 * 1024 * 1024,
} as const;

/**
 * Map catalog limits → `account_plan_limits` columns for upserts.
 * `clientRequestCreditAllowance` stays NULL when unset (= zero credits later).
 */
export function accountPlanLimitColumnsFromCatalog(
  limits: OzerPlanLimits,
  overrides?: {
    maxMembers?: number | null;
    maxProjectGuests?: number | null;
  },
): {
  max_members: number | null;
  max_properties: number | null;
  max_videos: number | null;
  max_project_guests: number | null;
  max_active_clients: number | null;
  max_invoices_per_month: number | null;
  max_open_tasks: number | null;
  max_bookings_per_month: number | null;
  max_portal_storage_bytes: number | null;
  client_request_credit_allowance: number | null;
  meeting_coaching_enabled: boolean;
} {
  return {
    max_members: overrides?.maxMembers ?? limits.maxMembers,
    max_properties: limits.maxProperties,
    max_videos: limits.maxVideos,
    max_project_guests: overrides?.maxProjectGuests ?? null,
    max_active_clients: limits.maxActiveClients ?? null,
    max_invoices_per_month: limits.maxInvoicesPerMonth ?? null,
    max_open_tasks: limits.maxOpenTasks ?? null,
    max_bookings_per_month: limits.maxBookingsPerMonth ?? null,
    max_portal_storage_bytes: limits.maxPortalStorageBytes ?? null,
    client_request_credit_allowance:
      limits.clientRequestCreditAllowance ?? null,
    meeting_coaching_enabled: limits.meetingCoachingEnabled ?? false,
  };
}

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
    limits: {
      maxMembers: 2,
      maxProperties: null,
      maxVideos: null,
      maxActiveClients: 3,
      maxInvoicesPerMonth: 5,
      maxOpenTasks: 20,
      maxBookingsPerMonth: 5,
      maxPortalStorageBytes: PORTAL_STORAGE_BYTES.free,
      clientRequestCreditAllowance: null,
      meetingCoachingEnabled: false,
    },
    workspaceProfiles: ['work_design'],
  },
];

const BUSINESS_STARTER: OzerPlanDefinition[] = [
  {
    productId: 'ozer-business-starter',
    planId: 'business-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.business_starter_monthly,
    family: 'business_starter',
    entitlementKey: 'workspace_business_starter',
    // Dynamic: sync derives max_members / guests from Stripe quantity
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxActiveClients: null,
      maxInvoicesPerMonth: null,
      maxOpenTasks: null,
      maxBookingsPerMonth: null,
      maxPortalStorageBytes: PORTAL_STORAGE_BYTES.starter,
      clientRequestCreditAllowance: null,
      meetingCoachingEnabled: false,
    },
    workspaceProfiles: ['work_design'],
  },
];

const BUSINESS: OzerPlanDefinition[] = [
  {
    productId: 'ozer-business',
    planId: 'business-monthly',
    stripePriceId: OZER_STRIPE_PRICES.business_monthly,
    family: 'business',
    entitlementKey: 'workspace_business',
    // Dynamic: sync derives max_members / guests / AI from Stripe quantity
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxActiveClients: null,
      maxInvoicesPerMonth: null,
      maxOpenTasks: null,
      maxBookingsPerMonth: null,
      maxPortalStorageBytes: PORTAL_STORAGE_BYTES.pro,
      clientRequestCreditAllowance: null,
      meetingCoachingEnabled: true,
    },
    workspaceProfiles: ['work_design'],
  },
  {
    productId: 'ozer-business',
    planId: 'business-yearly',
    stripePriceId: OZER_STRIPE_PRICES.business_yearly,
    family: 'business',
    entitlementKey: 'workspace_business',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxActiveClients: null,
      maxInvoicesPerMonth: null,
      maxOpenTasks: null,
      maxBookingsPerMonth: null,
      maxPortalStorageBytes: PORTAL_STORAGE_BYTES.pro,
      clientRequestCreditAllowance: null,
      meetingCoachingEnabled: true,
    },
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

const COMMERCIAL_PROPERTY: OzerPlanDefinition[] = [
  {
    productId: 'ozer-commercial-property',
    planId: 'commercial-property-monthly',
    stripePriceId: OZER_STRIPE_PRICES.commercial_property_monthly,
    family: 'commercial_property',
    entitlementKey: 'workspace_commercial_property',
    // Dynamic: sync derives from Stripe quantity + free support seats
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
    workspaceProfiles: ['commercial_property'],
  },
];

const ADDONS: OzerPlanDefinition[] = [
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_starter_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 10,
    },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_starter_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 10,
    },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-team-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_team_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 50,
    },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-team-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_team_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 50,
    },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-office-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_office_monthly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 150,
    },
  },
  {
    productId: 'ozer-addon-signatures',
    planId: 'signatures-office-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_signatures_office_yearly,
    family: 'addon_signatures',
    entitlementKey: 'addon_signatures',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxMailboxes: 150,
    },
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
    productId: 'ozer-addon-site-studio',
    planId: 'site-studio-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_site_studio_monthly,
    family: 'addon_site_studio',
    entitlementKey: 'addon_site_studio',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-site-studio',
    planId: 'site-studio-yearly',
    stripePriceId: OZER_STRIPE_PRICES.addon_site_studio_yearly,
    family: 'addon_site_studio',
    entitlementKey: 'addon_site_studio',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-email-assistant',
    planId: 'email-assistant-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_email_assistant_monthly,
    family: 'addon_email_assistant',
    entitlementKey: 'addon_email_assistant',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-portal-publishing',
    planId: 'portal-publishing-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_portal_publishing_monthly,
    family: 'addon_portal_publishing',
    entitlementKey: 'addon_portal_publishing',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-media-starter',
    planId: 'media-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.media_starter_monthly,
    family: 'addon_media_generate',
    entitlementKey: 'addon_media_generate',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-media-studio',
    planId: 'media-studio-monthly',
    stripePriceId: OZER_STRIPE_PRICES.media_studio_monthly,
    family: 'addon_media_generate',
    entitlementKey: 'addon_media_generate',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-media-agency',
    planId: 'media-agency-monthly',
    stripePriceId: OZER_STRIPE_PRICES.media_agency_monthly,
    family: 'addon_media_generate',
    entitlementKey: 'addon_media_generate',
    limits: { maxMembers: null, maxProperties: null, maxVideos: null },
  },
  {
    productId: 'ozer-addon-campaigns',
    planId: 'campaigns-starter-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_campaigns_starter_monthly,
    family: 'addon_campaigns',
    entitlementKey: 'addon_campaigns',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxContacts: 500,
      maxEmails: 2000,
    },
  },
  {
    productId: 'ozer-addon-campaigns',
    planId: 'campaigns-growth-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_campaigns_growth_monthly,
    family: 'addon_campaigns',
    entitlementKey: 'addon_campaigns',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxContacts: 2500,
      maxEmails: 10000,
    },
  },
  {
    productId: 'ozer-addon-campaigns',
    planId: 'campaigns-pro-monthly',
    stripePriceId: OZER_STRIPE_PRICES.addon_campaigns_pro_monthly,
    family: 'addon_campaigns',
    entitlementKey: 'addon_campaigns',
    limits: {
      maxMembers: null,
      maxProperties: null,
      maxVideos: null,
      maxContacts: 10000,
      maxEmails: 50000,
    },
  },
];

export const OZER_PLAN_CATALOG: OzerPlanDefinition[] = [
  ...COMMUNITY,
  ...BUSINESS_LITE,
  ...BUSINESS_STARTER,
  ...BUSINESS,
  ...PROPERTY,
  ...COMMERCIAL_PROPERTY,
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
    case 'commercial_property':
      return 'workspace_commercial_property';
    case 'building_surveyor':
      return null;
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

export function catalogPlansForAddonProduct(
  productId: string,
): OzerPlanDefinition[] {
  return OZER_PLAN_CATALOG.filter((plan) => plan.productId === productId);
}

export type OzerAddonKey =
  | 'addon_signatures'
  | 'addon_rankly'
  | 'addon_feedflow'
  | 'addon_videos'
  | 'addon_site_studio'
  | 'addon_portal_publishing'
  | 'addon_media_generate'
  | 'addon_campaigns';

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
  {
    key: 'addon_site_studio',
    productId: 'ozer-addon-site-studio',
    name: 'Site Studio',
    description:
      'AI website planning: brief → canvas sitemap → wireframes → style system → SEO/AEO → export packs for Webflow (Client-First), Astro, Next.js, and Cursor/Claude prompts.',
    fromPriceGbp: 19,
  },
  {
    key: 'addon_portal_publishing',
    productId: 'ozer-addon-portal-publishing',
    name: 'Portal Publishing',
    description:
      'Publish commercial listings to Rightmove, EACH, and Property Hive from Ozer.',
    fromPriceGbp: 79,
  },
  {
    key: 'addon_media_generate',
    productId: 'ozer-addon-media-starter',
    name: 'Media Generate',
    description:
      'AI image and video generation billed in media units — separate from Ozer AI text credits.',
    fromPriceGbp: 5,
  },
  {
    key: 'addon_campaigns',
    productId: 'ozer-addon-campaigns',
    name: 'Campaigns',
    description:
      'Workspace-branded email campaigns to your mailing list. Priced by contact list size and emails sent.',
    fromPriceGbp: 19,
  },
];

/**
 * Workspace add-ons available to purchase (billing catalog / apps marketplace).
 * Site Studio is intentionally not launched yet — see IN_DEVELOPMENT.
 */
export const LAUNCHED_WORKSPACE_ADDON_KEYS: OzerAddonKey[] = [
  'addon_signatures',
  'addon_media_generate',
  'addon_campaigns',
];

/**
 * Add-ons shown as “coming soon” on the settings add-ons page.
 */
export const IN_DEVELOPMENT_WORKSPACE_ADDON_KEYS: OzerAddonKey[] = [
  'addon_site_studio',
  'addon_rankly',
  'addon_feedflow',
  'addon_videos',
  'addon_portal_publishing',
];

export function launchedWorkspaceAddons() {
  return OZER_ADDON_CATALOG.filter((addon) =>
    LAUNCHED_WORKSPACE_ADDON_KEYS.includes(addon.key),
  );
}

export function inDevelopmentWorkspaceAddons() {
  return OZER_ADDON_CATALOG.filter((addon) =>
    IN_DEVELOPMENT_WORKSPACE_ADDON_KEYS.includes(addon.key),
  );
}

export function launchedAddonProductIds(): string[] {
  return [
    ...new Set(launchedWorkspaceAddons().map((addon) => addon.productId)),
  ];
}

/**
 * True when a billing product may be purchased as a workspace add-on.
 * Non-addon products (workspace plans, AI credits, media top-ups) always pass.
 * Add-on products must belong to a launched entitlement family (all tiers).
 */
export function isPurchasableWorkspaceAddonProduct(productId: string): boolean {
  if (!productId.startsWith('ozer-addon-')) {
    return true;
  }

  const plans = OZER_PLAN_CATALOG.filter(
    (plan) => plan.productId === productId,
  );
  if (plans.length === 0) {
    return false;
  }

  return plans.every((plan) =>
    LAUNCHED_WORKSPACE_ADDON_KEYS.includes(plan.entitlementKey as OzerAddonKey),
  );
}
