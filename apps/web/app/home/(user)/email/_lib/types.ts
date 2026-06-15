export type EmailParticipant = {
  name: string | null;
  email: string;
};

export type EmailThreadSummary = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: EmailParticipant[];
  is_unread: boolean;
  last_message_at: string | null;
};

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
  connection: { googleEmail: string; connectedAt: string } | null;
  settings: {
    styleNotes: string;
    signature: string;
    lastSyncedAt: string | null;
  };
  threads: EmailThreadSummary[];
  workspaces: EmailWorkspaceOption[];
};

export type EmailThreadDetail = {
  thread: EmailThreadSummary;
  messages: EmailMessageRow[];
  actionItems: EmailActionItemRow[];
  draft: EmailDraftRow | null;
};
