/** Matches `email_action_items` insert shape from AI extraction. */
export type EmailActionItem = {
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
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
  }>;
};
