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

/** Commercial agency deal pipeline stages (stored on pipeline_deals.stage). */
export const COMMERCIAL_PIPELINE_STAGES = [
  'enquiry',
  'viewing',
  'offer',
  'hots',
  'solicitors',
  'completed',
  'fell_through',
] as const;

export type CommercialPipelineStage =
  (typeof COMMERCIAL_PIPELINE_STAGES)[number];

export const COMMERCIAL_PIPELINE_STAGE_LABELS: Record<
  CommercialPipelineStage,
  string
> = {
  enquiry: 'Enquiry',
  viewing: 'Viewing',
  offer: 'Offer',
  hots: 'HoTs',
  solicitors: 'Solicitors',
  completed: 'Completed',
  fell_through: 'Fell through',
};

export const COMMERCIAL_PIPELINE_BOARD_STAGES = [
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'viewing', label: 'Viewing' },
  { key: 'offer', label: 'Offer' },
  { key: 'hots', label: 'HoTs' },
  { key: 'solicitors', label: 'Solicitors' },
  { key: 'completed', label: 'Completed' },
  { key: 'fell_through', label: 'Fell through' },
] as const;

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
