import type { CampaignDocument } from './campaign-document';

export type EmailCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'cancelled'
  | 'failed';

export type EmailCampaign = {
  id: string;
  accountId: string;
  createdBy: string | null;
  name: string;
  subject: string;
  previewText: string | null;
  htmlBody: string;
  bodyDocument: CampaignDocument | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  unsubscribedCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  complaintCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailCampaignRecipient = {
  id: string;
  campaignId: string;
  email: string;
  displayName: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  skipReason: string | null;
  errorMessage: string | null;
  sesMessageId: string | null;
  sentAt: string | null;
  unsubscribedAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  bouncedAt: string | null;
  bounceType: string | null;
  bounceSubtype: string | null;
  complaintAt: string | null;
};

export type CampaignCreditPool = {
  account_id: string;
  balance: number;
  monthly_allowance: number;
  max_contacts: number;
  plan_tier: string;
  cycle_start: string | null;
  cycle_end: string | null;
};
