/** Shared constants for the commercial-property workspace. */

export const LISTING_STATUSES = [
  'draft',
  'instructed',
  'marketing',
  'under_offer',
  'let',
  'sold',
  'withdrawn',
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draft',
  instructed: 'Instructed',
  marketing: 'Marketing',
  under_offer: 'Under offer',
  let: 'Let',
  sold: 'Sold',
  withdrawn: 'Withdrawn',
};

export const DISPOSAL_TYPES = [
  'to_let',
  'for_sale',
  'investment',
  'to_let_and_for_sale',
] as const;

export type DisposalType = (typeof DISPOSAL_TYPES)[number];

export const DISPOSAL_TYPE_LABELS: Record<DisposalType, string> = {
  to_let: 'To let',
  for_sale: 'For sale',
  investment: 'Investment',
  to_let_and_for_sale: 'To let & for sale',
};

/** Occupational disposal types (leasing / sale) vs investment. */
export const OCCUPATIONAL_DISPOSAL_TYPES = [
  'to_let',
  'for_sale',
  'to_let_and_for_sale',
] as const;

export function disposalIncludesToLet(type: DisposalType): boolean {
  return type === 'to_let' || type === 'to_let_and_for_sale';
}

/**
 * Canonical property types for disposals + requirements (stored in `sector`).
 * Labels are agent-facing; Rightmove classification still uses fuzzy matching.
 */
export const COMMERCIAL_PROPERTY_TYPES = [
  'Offices',
  'Industrial / Warehouse',
  'Retail',
  'Leisure',
  'Retail / Leisure',
  'Land',
  'Mixed use',
  'Investment',
  'Development',
] as const;

export type CommercialPropertyType = (typeof COMMERCIAL_PROPERTY_TYPES)[number];

/**
 * UK planning use classes for disposals (stored in `use_class`).
 * Values are Rightmove ADF enum tokens so publish mapping stays exact.
 */
export const COMMERCIAL_USE_CLASSES = [
  'CLASS_E',
  'CLASS_B2',
  'CLASS_B8',
  'CLASS_F1',
  'CLASS_F2',
  'CLASS_C1',
  'CLASS_C2',
  'CLASS_C2A',
  'CLASS_C3',
  'CLASS_C4',
  'CLASS_1A',
  'SUI_GENERIS',
] as const;

export type CommercialUseClass = (typeof COMMERCIAL_USE_CLASSES)[number];

export const COMMERCIAL_USE_CLASS_LABELS: Record<CommercialUseClass, string> = {
  CLASS_E: 'Class E – Commercial, Business and Service',
  CLASS_B2: 'Class B2 – General industrial',
  CLASS_B8: 'Class B8 – Storage or distribution',
  CLASS_F1: 'Class F1 – Learning and non-residential institutions',
  CLASS_F2: 'Class F2 – Local community',
  CLASS_C1: 'Class C1 – Hotels',
  CLASS_C2: 'Class C2 – Residential institutions',
  CLASS_C2A: 'Class C2A – Secure residential institutions',
  CLASS_C3: 'Class C3 – Dwellinghouses',
  CLASS_C4: 'Class C4 – Houses in multiple occupation',
  CLASS_1A: 'Class 1A – Shops (Scotland)',
  SUI_GENERIS: 'Sui generis',
};

export function isCommercialUseClass(
  value: string | null | undefined,
): value is CommercialUseClass {
  return (
    !!value &&
    (COMMERCIAL_USE_CLASSES as readonly string[]).includes(value.trim())
  );
}

export function formatCommercialUseClassLabel(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (isCommercialUseClass(trimmed)) {
    return COMMERCIAL_USE_CLASS_LABELS[trimmed];
  }
  return trimmed;
}

export function disposalIncludesForSale(type: DisposalType): boolean {
  return (
    type === 'for_sale' ||
    type === 'investment' ||
    type === 'to_let_and_for_sale'
  );
}

export const TERMS_OF_ENGAGEMENT = ['yes', 'no', 'pending'] as const;

export type TermsOfEngagement = (typeof TERMS_OF_ENGAGEMENT)[number];

export const TERMS_OF_ENGAGEMENT_LABELS: Record<TermsOfEngagement, string> = {
  yes: 'Yes — agreed',
  no: 'No',
  pending: 'Pending',
};

/** Roles for people/companies on a disposal or commercial property asset. */
export const LISTING_PARTY_ROLES = [
  'landlord',
  'landlord_representative',
  'tenant',
  'managing_agent',
  'solicitor',
  'other',
] as const;

export type ListingPartyRole = (typeof LISTING_PARTY_ROLES)[number];

export const LISTING_PARTY_ROLE_LABELS: Record<ListingPartyRole, string> = {
  landlord: 'Landlord',
  landlord_representative: 'Landlord representative',
  tenant: 'Tenant',
  managing_agent: 'Managing agent',
  solicitor: 'Solicitor',
  other: 'Other',
};

/** Alias for property parties — same vocabulary as listing parties. */
export const PROPERTY_PARTY_ROLES = LISTING_PARTY_ROLES;
export type PropertyPartyRole = ListingPartyRole;
export const PROPERTY_PARTY_ROLE_LABELS = LISTING_PARTY_ROLE_LABELS;

export const LISTING_SIZE_BREAKDOWNS = [
  'floor_by_floor',
  'unit_by_unit',
  'total_only',
  'unknown',
] as const;

export type ListingSizeBreakdown = (typeof LISTING_SIZE_BREAKDOWNS)[number];

export const LISTING_SIZE_BREAKDOWN_LABELS: Record<
  ListingSizeBreakdown,
  string
> = {
  floor_by_floor: 'Floor by floor',
  unit_by_unit: 'Unit by unit',
  total_only: 'Total only',
  unknown: 'Unknown',
};

export const LISTING_CONTROLLED_BY = [
  'agent',
  'landlord',
  'vendor',
  'unknown',
] as const;

export type ListingControlledBy = (typeof LISTING_CONTROLLED_BY)[number];

export const LISTING_CONTROLLED_BY_LABELS: Record<ListingControlledBy, string> =
  {
    agent: 'Agent',
    landlord: 'Landlord',
    vendor: 'Vendor',
    unknown: 'Unknown',
  };

export const LISTING_SIZE_ACCURACIES = [
  'approximate',
  'measured',
  'estimated',
  'unknown',
] as const;

export type ListingSizeAccuracy = (typeof LISTING_SIZE_ACCURACIES)[number];

export const LISTING_SIZE_ACCURACY_LABELS: Record<ListingSizeAccuracy, string> =
  {
    approximate: 'Approximate',
    measured: 'Measured',
    estimated: 'Estimated',
    unknown: 'Unknown',
  };

export const BREEAM_RATINGS = [
  'outstanding',
  'excellent',
  'very_good',
  'good',
  'pass',
  'unclassified',
  'n_a',
] as const;

export type BreeamRating = (typeof BREEAM_RATINGS)[number];

export const BREEAM_RATING_LABELS: Record<BreeamRating, string> = {
  outstanding: 'Outstanding',
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  pass: 'Pass',
  unclassified: 'Unclassified',
  n_a: 'N/A',
};

/** Semantic badge classes for disposal type pills (bg + text). */
export const DISPOSAL_TYPE_BADGE_CLASS: Record<DisposalType, string> = {
  for_sale:
    'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  to_let:
    'bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-200/80 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-500/30',
  investment:
    'bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-100 dark:ring-violet-500/30',
  to_let_and_for_sale:
    'bg-cyan-100 text-cyan-900 ring-1 ring-inset ring-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-100 dark:ring-cyan-500/30',
};

/** Normalised sector keys for colour-coded pills. */
export type CommercialSectorKey =
  | 'office'
  | 'industrial'
  | 'retail'
  | 'leisure'
  | 'land'
  | 'residential'
  | 'investment'
  | 'development'
  | 'other';

export const SECTOR_BADGE_CLASS: Record<CommercialSectorKey, string> = {
  office:
    'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/30',
  industrial:
    'bg-slate-200/80 text-slate-800 ring-1 ring-inset ring-slate-300/80 dark:bg-slate-500/20 dark:text-slate-100 dark:ring-slate-500/35',
  retail:
    'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/30',
  leisure:
    'bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200/80 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/30',
  land: 'bg-lime-100 text-lime-900 ring-1 ring-inset ring-lime-200/80 dark:bg-lime-500/15 dark:text-lime-100 dark:ring-lime-500/30',
  residential:
    'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  investment:
    'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  development:
    'bg-cyan-100 text-cyan-900 ring-1 ring-inset ring-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-100 dark:ring-cyan-500/30',
  other:
    'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200/80 dark:bg-zinc-500/15 dark:text-zinc-200 dark:ring-zinc-500/30',
};

/** Split multi-value sector strings like "Office, Retail". */
export function splitSectorLabels(sector: string | null | undefined): string[] {
  if (!sector?.trim()) return [];
  return sector
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveSectorKey(raw: string): CommercialSectorKey {
  const value = raw.trim().toLowerCase();
  if (!value) return 'other';
  if (value.includes('office') || value.includes('serviced')) return 'office';
  if (
    value.includes('industrial') ||
    value.includes('logistics') ||
    value.includes('warehouse') ||
    value.includes('storage') ||
    value.includes('trade')
  ) {
    return 'industrial';
  }
  if (value.includes('retail') || value.includes('shop')) return 'retail';
  if (value.includes('leisure') || value.includes('hospitality')) {
    return 'leisure';
  }
  if (value.includes('land') || value.includes('agricultural')) return 'land';
  if (value.includes('residential') || value.includes('housing')) {
    return 'residential';
  }
  if (value.includes('investment')) return 'investment';
  if (value.includes('development') || value.includes('site')) {
    return 'development';
  }
  return 'other';
}

export function sectorBadgeClass(sector: string): string {
  return SECTOR_BADGE_CLASS[resolveSectorKey(sector)];
}

/** Semantic badge classes for listing status pills. */
export const LISTING_STATUS_BADGE_CLASS: Record<ListingStatus, string> = {
  draft:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-500/30',
  instructed:
    'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/30',
  marketing:
    'bg-[var(--ozer-coral-100)] text-[var(--ozer-coral-600)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)] dark:bg-[var(--ozer-accent-subtle)] dark:text-[var(--ozer-coral-50)] dark:ring-[color-mix(in_srgb,var(--ozer-accent)_40%,transparent)]',
  under_offer:
    'bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200/80 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/30',
  let: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  sold: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  withdrawn:
    'bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200/80 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30',
};

/** Filter chip classes when a status filter is active. */
export const LISTING_STATUS_FILTER_ACTIVE_CLASS: Record<ListingStatus, string> =
  {
    draft: 'bg-slate-600 text-white',
    instructed: 'bg-sky-600 text-white',
    marketing: 'bg-[var(--ozer-accent)] text-white',
    under_offer: 'bg-orange-600 text-white',
    let: 'bg-emerald-600 text-white',
    sold: 'bg-emerald-700 text-white',
    withdrawn: 'bg-zinc-500 text-white',
  };

/**
 * Commercial Instruction (WIP) stages — Bracketts language.
 * Stored on pipeline_deals.stage for commercial-property workspaces.
 */
export const COMMERCIAL_PIPELINE_STAGES = [
  'potential',
  'current',
  'under_offer_negotiating',
  'completed_exchanged',
  'fallen_through',
] as const;

export type CommercialPipelineStage =
  (typeof COMMERCIAL_PIPELINE_STAGES)[number];

export const COMMERCIAL_PIPELINE_STAGE_LABELS: Record<
  CommercialPipelineStage,
  string
> = {
  potential: 'Potential Instructions',
  current: 'Current Instructions',
  under_offer_negotiating: 'Under Offer / Negotiating',
  completed_exchanged: 'Completed / Exchanged',
  fallen_through: 'Fallen through',
};

/** Stages shown on the board by default. */
export const COMMERCIAL_PIPELINE_BOARD_STAGES = [
  { key: 'potential', label: 'Potential Instructions', hidden: false },
  { key: 'current', label: 'Current Instructions', hidden: false },
  {
    key: 'under_offer_negotiating',
    label: 'Under Offer / Negotiating',
    hidden: false,
  },
  {
    key: 'completed_exchanged',
    label: 'Completed / Exchanged',
    hidden: false,
  },
  { key: 'fallen_through', label: 'Fallen through', hidden: false },
] as const;

/** Terminal “won” stage for commercial instructions. */
export const COMMERCIAL_PIPELINE_WON_STAGE: CommercialPipelineStage =
  'completed_exchanged';

/** Terminal “lost” stage for commercial instructions. */
export const COMMERCIAL_PIPELINE_LOST_STAGE: CommercialPipelineStage =
  'fallen_through';

/** Default nav / page title for the commercial instructions board. */
export const DEFAULT_COMMERCIAL_WIP_BOARD_NAME = 'WIP';

/**
 * Legacy / Kato keys remapped into WIP Instruction stages.
 * Kept so old rows and clients normalize cleanly.
 */
export const COMMERCIAL_PIPELINE_LEGACY_STAGE_MAP: Record<
  string,
  CommercialPipelineStage
> = {
  // Pre-WIP Kato interest keys
  shortlisted: 'potential',
  enquiry: 'potential',
  viewing: 'current',
  negotiating: 'under_offer_negotiating',
  under_offer: 'under_offer_negotiating',
  signed: 'completed_exchanged',
  idle: 'potential',
  discounted: 'fallen_through',
  // Older commercial keys
  offer: 'under_offer_negotiating',
  hots: 'under_offer_negotiating',
  solicitors: 'under_offer_negotiating',
  completed: 'completed_exchanged',
  fell_through: 'fallen_through',
};

export const DEFAULT_PIPELINE_BOARD_STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const;

export const COMMERCIAL_CLIENT_ROLES = [
  'landlord',
  'tenant',
  'investor',
  'solicitor',
  'agent',
] as const;

export type CommercialClientRole = (typeof COMMERCIAL_CLIENT_ROLES)[number];

export const COMMERCIAL_CLIENT_ROLE_LABELS: Record<
  CommercialClientRole,
  string
> = {
  landlord: 'Landlord',
  tenant: 'Tenant',
  investor: 'Investor',
  solicitor: 'Solicitor',
  agent: 'Agent',
};

export const ENQUIRY_STATUSES = [
  'unactioned',
  'on_schedule',
  'archived',
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  unactioned: 'Unactioned',
  on_schedule: 'On schedule',
  archived: 'Archived',
};

export const ENQUIRY_SOURCES = [
  'manual',
  'website',
  'rightmove',
  'each',
  'other',
  'brochure',
] as const;

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  manual: 'Manual',
  website: 'Website',
  rightmove: 'Rightmove',
  each: 'EACH',
  other: 'Other',
  brochure: 'Brochure',
};

/** Requirement pipeline stages (commercial_requirements.stage). */
export const REQUIREMENT_STATUSES = [
  'new',
  'actively_searching',
  'under_offer_negotiating',
  'fulfilled',
  'withdrawn',
] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  new: 'New',
  actively_searching: 'Actively Searching',
  under_offer_negotiating: 'Under Offer / Negotiating',
  fulfilled: 'Fulfilled',
  withdrawn: 'Withdrawn',
};

/** Map legacy Kato requirement stages into the WIP set. */
export const REQUIREMENT_LEGACY_STAGE_MAP: Record<string, RequirementStatus> = {
  unactioned: 'new',
  prospect: 'new',
  search: 'actively_searching',
  viewing: 'actively_searching',
  ongoing: 'actively_searching',
  on_hold: 'actively_searching',
  negotiating: 'under_offer_negotiating',
  under_offer: 'under_offer_negotiating',
  success: 'fulfilled',
  unsuccessful: 'withdrawn',
};

export function normalizeRequirementStage(stage: string): RequirementStatus {
  if ((REQUIREMENT_STATUSES as readonly string[]).includes(stage)) {
    return stage as RequirementStatus;
  }
  return REQUIREMENT_LEGACY_STAGE_MAP[stage] ?? 'new';
}

/** Interest Schedule statuses on commercial_matches.status. */
export const INTEREST_STATUSES = [
  'new',
  'viewing_arranged',
  'viewed',
  'offer_made',
  'negotiating',
  'under_offer',
  'agreed',
  'withdrawn',
  'lost',
] as const;

export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = {
  new: 'New',
  viewing_arranged: 'Viewing arranged',
  viewed: 'Viewed',
  offer_made: 'Offer made',
  negotiating: 'Negotiating',
  under_offer: 'Under offer',
  agreed: 'Agreed',
  withdrawn: 'Withdrawn',
  lost: 'Lost',
};

export const INTEREST_LEGACY_STATUS_MAP: Record<string, InterestStatus> = {
  shortlisted: 'new',
  enquiry: 'new',
  idle: 'new',
  viewing: 'viewing_arranged',
  signed: 'agreed',
  discounted: 'lost',
};

export function normalizeInterestStatus(status: string): InterestStatus {
  if ((INTEREST_STATUSES as readonly string[]).includes(status)) {
    return status as InterestStatus;
  }
  return INTEREST_LEGACY_STATUS_MAP[status] ?? 'new';
}

export const VIEWING_STATUSES = [
  'upcoming',
  'completed',
  'cancelled',
  'awaiting_feedback',
] as const;

export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

/** Sentiment captured after a viewing (stored on commercial_viewings.outcome). */
export const VIEWING_OUTCOMES = ['positive', 'neutral', 'negative'] as const;

export type ViewingOutcome = (typeof VIEWING_OUTCOMES)[number];

export const VIEWING_OUTCOME_LABELS: Record<ViewingOutcome, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

export const LEASE_STATUSES = [
  'active',
  'expired',
  'terminated',
  'completed',
] as const;

export type LeaseStatus = (typeof LEASE_STATUSES)[number];
