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
};

export type EmailThreadSummary = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: EmailParticipant[];
  is_unread: boolean;
  last_message_at: string | null;
  assistant_category: 'needs_reply' | 'no_reply' | null;
  link: EmailThreadLink;
};

export type EmailInboxFilter = 'all' | 'needs_reply' | 'linked';

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
  settings: {
    styleNotes: string;
    signature: string;
    signatureIsHtml: boolean;
    lastSyncedAt: string | null;
    autoTriageEnabled: boolean;
    autoDraftEnabled: boolean;
    autoSaveGmailDrafts: boolean;
  };
  threads: EmailThreadSummary[];
  hasMoreThreads: boolean;
  workspaces: EmailWorkspaceOption[];
};

export type EmailThreadDetail = {
  thread: EmailThreadSummary;
  messages: EmailMessageRow[];
  actionItems: EmailActionItemRow[];
  draft: EmailDraftRow | null;
};
