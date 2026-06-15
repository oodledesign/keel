/** Matches `email_action_items` insert shape from AI extraction. */
export type EmailActionItem = {
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
};

export type ExtractResponseJson = {
  items: Array<{
    title: string;
    detail?: string | null;
    suggested_due_date?: string | null;
  }>;
};
