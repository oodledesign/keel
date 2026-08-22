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
  /** Optional guidance for how the AI should group or phrase extracted tasks. */
  instructions?: string | null;
};

export type EmailThreadCategory =
  | 'reply_now'
  | 'reply_later'
  | 'waiting'
  | 'fyi'
  | 'noise';

export type ClassifyResponseJson = {
  category: EmailThreadCategory;
  reason?: string | null;
  confidence?: number | null;
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

export type DetectPipelineLeadResponseJson = {
  is_lead: boolean;
  contact_name?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  description?: string | null;
  reason?: string | null;
  confidence?: number | null;
};

export type PipelineLeadDetection = {
  isLead: boolean;
  contactName: string | null;
  companyName: string | null;
  contactEmail: string | null;
  description: string | null;
  reason: string | null;
  confidence: number | null;
};
