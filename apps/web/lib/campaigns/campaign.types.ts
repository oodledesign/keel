import type {
  CampaignAudienceConfig,
  CampaignAudienceType,
} from './campaign-audience';
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
  subjectB: string | null;
  abEnabled: boolean;
  abSplitPercent: number;
  previewText: string | null;
  htmlBody: string;
  bodyDocument: CampaignDocument | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  audienceType: CampaignAudienceType;
  audienceConfig: CampaignAudienceConfig;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  scheduledTimezone: string;
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
  abVariant: 'a' | 'b' | null;
};

export type CampaignCreditPool = {
  account_id: string;
  balance: number;
  monthly_allowance: number;
  max_contacts: number;
  contact_bonus: number;
  plan_tier: string;
  cycle_start: string | null;
  cycle_end: string | null;
};

export type CampaignAudienceList = {
  id: string;
  accountId: string;
  createdBy: string | null;
  name: string;
  source: 'subscribers' | 'clients' | 'contacts';
  matchMode: 'all' | 'any';
  filters: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAutomation = {
  id: string;
  accountId: string;
  createdBy: string | null;
  name: string;
  triggerType: 'new_subscriber';
  campaignId: string | null;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
};

export type CampaignAutomationRun = {
  id: string;
  automationId: string;
  campaignId: string | null;
  email: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};
