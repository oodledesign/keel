export type LinkedInConnectionStatus =
  | 'connected'
  | 'needs_reconnect'
  | 'disconnected';

export type LinkedInPostStatus =
  | 'draft'
  | 'scheduled'
  | 'posting'
  | 'posted'
  | 'failed';

export type LinkedInOrgConnectionPublic = {
  orgId: string;
  orgUrn: string;
  orgName: string | null;
  status: LinkedInConnectionStatus;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
};

export type ListingLinkedInPostPublic = {
  id: string;
  body: string;
  imageMediaIds: string[];
  overlayFirst: boolean;
  listingUrl: string | null;
  status: LinkedInPostStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  linkedinPostUrn: string | null;
  linkedinPostUrl: string | null;
  error: string | null;
  updatedAt: string;
};

export type LinkedInCopySource = 'ai' | 'manual' | 'description';
