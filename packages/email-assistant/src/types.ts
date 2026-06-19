/** Matches `email_action_items` insert shape from AI extraction. */
export type EmailActionItem = {
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
  sourceExcerpt: string | null;
  /** 0-1 confidence that suggestedAssigneeEmail is correct. */
  assigneeConfidence: number | null;
  /** Lowercased email of suggested assignee, or null when ambiguous. */
  suggestedAssigneeEmail: string | null;
};

export type ExtractAccountMember = {
  userId: string;
  name: string | null;
  email: string;
};

export type ExtractContext = {
  mailboxOwnerEmail: string;
  mailboxOwnerName: string | null;
  accountMembers: ExtractAccountMember[];
};

export type EmailThreadCategory = 'needs_reply' | 'no_reply';

export type ClassifyResponseJson = {
  category: EmailThreadCategory;
  reason?: string | null;
};

export type ExtractResponseJson = {
  items: Array<{
    title: string;
    detail?: string | null;
    suggested_due_date?: string | null;
    source_excerpt?: string | null;
    assignee_confidence?: number | null;
    suggested_assignee_email?: string | null;
  }>;
};
