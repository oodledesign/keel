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

export const DISPOSAL_TYPES = ['to_let', 'for_sale', 'investment'] as const;

export type DisposalType = (typeof DISPOSAL_TYPES)[number];

export const DISPOSAL_TYPE_LABELS: Record<DisposalType, string> = {
  to_let: 'To let',
  for_sale: 'For sale',
  investment: 'Investment',
};

/** Semantic badge classes for disposal type pills (bg + text). */
export const DISPOSAL_TYPE_BADGE_CLASS: Record<DisposalType, string> = {
  for_sale:
    'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  to_let:
    'bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-200/80 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-500/30',
  investment:
    'bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-100 dark:ring-violet-500/30',
};

/** Semantic badge classes for listing status pills. */
export const LISTING_STATUS_BADGE_CLASS: Record<ListingStatus, string> = {
  draft:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-500/30',
  instructed:
    'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/30',
  marketing:
    'bg-[color-mix(in_srgb,var(--ozer-accent)_16%,white)] text-[var(--ozer-accent-muted)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-accent)_28%,transparent)]',
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
 * Commercial agency deal pipeline stages (stored on pipeline_deals.stage).
 * Defaults mirror Kato interest-schedule progress statuses.
 */
export const COMMERCIAL_PIPELINE_STAGES = [
  'shortlisted',
  'enquiry',
  'viewing',
  'negotiating',
  'under_offer',
  'signed',
  'idle',
  'discounted',
] as const;

export type CommercialPipelineStage =
  (typeof COMMERCIAL_PIPELINE_STAGES)[number];

export const COMMERCIAL_PIPELINE_STAGE_LABELS: Record<
  CommercialPipelineStage,
  string
> = {
  shortlisted: 'Shortlisted',
  enquiry: 'Enquiry',
  viewing: 'Viewing',
  negotiating: 'Negotiating',
  under_offer: 'Under offer',
  signed: 'Signed',
  idle: 'Idle',
  discounted: 'Discounted',
};

/** Stages shown on the board by default (Idle hidden until unhidden). */
export const COMMERCIAL_PIPELINE_BOARD_STAGES = [
  { key: 'shortlisted', label: 'Shortlisted', hidden: false },
  { key: 'enquiry', label: 'Enquiry', hidden: false },
  { key: 'viewing', label: 'Viewing', hidden: false },
  { key: 'negotiating', label: 'Negotiating', hidden: false },
  { key: 'under_offer', label: 'Under offer', hidden: false },
  { key: 'signed', label: 'Signed', hidden: false },
  { key: 'idle', label: 'Idle', hidden: true },
  { key: 'discounted', label: 'Discounted', hidden: false },
] as const;

/** Terminal “won” stage for commercial deals. */
export const COMMERCIAL_PIPELINE_WON_STAGE: CommercialPipelineStage = 'signed';

/** Terminal “lost” stage for commercial deals. */
export const COMMERCIAL_PIPELINE_LOST_STAGE: CommercialPipelineStage =
  'discounted';

/** Legacy stage keys remapped to Kato defaults (see migration). */
export const COMMERCIAL_PIPELINE_LEGACY_STAGE_MAP: Record<
  string,
  CommercialPipelineStage
> = {
  offer: 'negotiating',
  hots: 'under_offer',
  solicitors: 'under_offer',
  completed: 'signed',
  fell_through: 'discounted',
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
] as const;

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  manual: 'Manual',
  website: 'Website',
  rightmove: 'Rightmove',
  each: 'EACH',
  other: 'Other',
};

/** Requirement pipeline stages (commercial_requirements.stage). */
export const REQUIREMENT_STATUSES = [
  'unactioned',
  'prospect',
  'search',
  'viewing',
  'negotiating',
  'under_offer',
  'success',
  'ongoing',
  'on_hold',
  'unsuccessful',
] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  unactioned: 'Unactioned',
  prospect: 'Prospect',
  search: 'Search',
  viewing: 'Viewing',
  negotiating: 'Negotiating',
  under_offer: 'Under offer',
  success: 'Success',
  ongoing: 'Ongoing',
  on_hold: 'On hold',
  unsuccessful: 'Unsuccessful',
};

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

export const LEASE_STATUSES = ['active', 'expired', 'terminated'] as const;

export type LeaseStatus = (typeof LEASE_STATUSES)[number];
