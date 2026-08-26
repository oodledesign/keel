export type EmailThreadCategory =
  | 'reply_now'
  | 'reply_later'
  | 'waiting'
  | 'fyi'
  | 'noise';

export type EmailThreadLinkSuggestion = {
  accountId: string | null;
  clientId: string | null;
  projectId: string | null;
  clientName: string | null;
  projectName: string | null;
};

export type EmailThreadPipelineLeadSuggestion = {
  accountId: string;
  contactName: string;
  companyName: string;
  contactEmail: string | null;
  description: string | null;
};

export type EmailThreadPipelineLead = {
  dealId: string | null;
  accountSlug: string | null;
};

export type EmailParticipant = {
  name: string | null;
  email: string;
};

export type EmailThreadLink = {
  accountId: string | null;
  clientId: string | null;
  projectId: string | null;
  linkSource: 'auto' | 'manual' | null;
  linked: boolean;
  accountName: string | null;
  clientName: string | null;
  projectName: string | null;
  clientPictureUrl?: string | null;
  linkColor?: string | null;
};

export type EmailThreadSummary = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: EmailParticipant[];
  label_ids: string[];
  is_unread: boolean;
  last_message_at: string | null;
  assistant_category: EmailThreadCategory | null;
  assistant_category_reason: string | null;
  assistant_category_confidence: number | null;
  follow_up_at: string | null;
  follow_up_note: string | null;
  link: EmailThreadLink;
  link_confidence: number | null;
  link_suggestion: EmailThreadLinkSuggestion | null;
  pipeline_lead_suggestion: EmailThreadPipelineLeadSuggestion | null;
  pipeline_lead_confidence: number | null;
  pipeline_deal_id: string | null;
};

export type EmailInboxFilter =
  | 'all'
  | 'action'
  | 'reply_later'
  | 'waiting'
  | 'fyi'
  | 'follow_up'
  | 'linked'
  | 'needs_reply';

export type EmailMessageRow = {
  id: string;
  from_address: string | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  internal_date: string | null;
};

export type EmailActionItemRow = {
  id: string;
  title: string;
  detail: string | null;
  suggested_due_date: string | null;
  source_excerpt: string | null;
  assignee_confidence: number | null;
  suggested_assignee_id: string | null;
  account_id: string | null;
  client_id: string | null;
  project_id: string | null;
  clientName?: string | null;
  projectName?: string | null;
  linkLabel?: string | null;
  status: string;
  task_id: string | null;
  created_at: string;
};

export type EmailDraftRow = {
  id: string;
  body_text: string;
  gmail_draft_id: string | null;
  status: string;
  updated_at: string;
};

export type EmailGmailLabel = {
  id: string;
  name: string;
  type: 'system' | 'user';
};

export type EmailWorkspaceOption = {
  id: string;
  slug: string;
  label: string;
};

export type EmailPageInitialData = {
  mailboxKind: 'business' | 'personal';
  preferredAccountId: string | null;
  accountSlug: string | null;
  connection: { googleEmail: string; connectedAt: string } | null;
  needsEmailOnboarding: boolean;
  settings: {
    styleNotes: string;
    signature: string;
    signatureIsHtml: boolean;
    lastSyncedAt: string | null;
    autoTriageEnabled: boolean;
    autoDraftEnabled: boolean;
    autoSaveGmailDrafts: boolean;
    allowSendFromOzer: boolean;
    syncTriageToGmail: boolean;
    respectExistingGmailLabels: boolean;
    onboardingCompletedAt: string | null;
    ignoredSenders: string[];
    ignoredDomains: string[];
    ignoredSubjectKeywords: string[];
    prioritySenders: string[];
    priorityDomains: string[];
    prioritySubjectKeywords: string[];
  };
  threads: EmailThreadSummary[];
  hasMoreThreads: boolean;
  gmailLabels: EmailGmailLabel[];
  workspaces: EmailWorkspaceOption[];
};

export type EmailThreadDetail = {
  thread: EmailThreadSummary;
  messages: EmailMessageRow[];
  actionItems: EmailActionItemRow[];
  draft: EmailDraftRow | null;
};
