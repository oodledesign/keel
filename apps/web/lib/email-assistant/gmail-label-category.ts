import type { EmailThreadCategory } from './email-thread-categories';

export type GmailLabelCategoryOverride = {
  category: EmailThreadCategory;
  reason: string;
};

/**
 * Gmail state that rules out a reply regardless of content: spam, trash, and
 * unsent drafts (a thread holding only your own draft, never delivered).
 */
export function categoryForGmailLabels(
  labelIds: readonly string[] | null | undefined,
): GmailLabelCategoryOverride | null {
  if (!labelIds?.length) return null;

  const labels = new Set(labelIds);

  if (labels.has('SPAM')) {
    return { category: 'noise', reason: 'In Gmail spam' };
  }
  if (labels.has('TRASH')) {
    return { category: 'noise', reason: 'In Gmail trash' };
  }
  if (labels.has('DRAFT') && !labels.has('INBOX') && !labels.has('SENT')) {
    return { category: 'noise', reason: 'Unsent draft' };
  }

  return null;
}
