export const EMAIL_THREAD_CATEGORIES = [
  'reply_now',
  'reply_later',
  'waiting',
  'fyi',
  'noise',
] as const;

export type EmailThreadCategory = (typeof EMAIL_THREAD_CATEGORIES)[number];

/** Categories that expect a reply from the mailbox owner. */
export const ACTIONABLE_EMAIL_CATEGORIES = [
  'reply_now',
  'reply_later',
] as const satisfies readonly EmailThreadCategory[];

export type ActionableEmailCategory =
  (typeof ACTIONABLE_EMAIL_CATEGORIES)[number];

export const EMAIL_THREAD_CATEGORY_LABELS: Record<EmailThreadCategory, string> =
  {
    reply_now: 'Reply now',
    reply_later: 'Reply later',
    waiting: 'Waiting',
    fyi: 'FYI',
    noise: 'Noise',
  };

export function isEmailThreadCategory(
  value: string | null | undefined,
): value is EmailThreadCategory {
  return (
    value != null &&
    (EMAIL_THREAD_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isActionableEmailCategory(
  category: string | null | undefined,
): category is ActionableEmailCategory {
  return (
    category != null &&
    (ACTIONABLE_EMAIL_CATEGORIES as readonly string[]).includes(category)
  );
}

export function normalizeEmailThreadCategory(
  value: string | null | undefined,
): EmailThreadCategory | null {
  if (!value) return null;
  if (value === 'needs_reply') return 'reply_now';
  if (value === 'no_reply') return 'noise';
  return isEmailThreadCategory(value) ? value : null;
}

export function categoryFromTriageRuleAction(
  action: 'ignore' | 'priority',
): EmailThreadCategory {
  return action === 'ignore' ? 'noise' : 'reply_now';
}

export function shouldAutoDraftCategory(
  category: EmailThreadCategory | null,
): boolean {
  return category === 'reply_now';
}

export function shouldAutoExtractCategory(
  category: EmailThreadCategory | null,
): boolean {
  return category === 'reply_now' || category === 'reply_later';
}

export function shouldAutoLinkCategory(
  category: EmailThreadCategory | null,
): boolean {
  return (
    category === 'reply_now' ||
    category === 'reply_later' ||
    category === 'waiting' ||
    category === 'fyi'
  );
}

export function shouldIndexForBrainCategory(
  category: EmailThreadCategory | null,
  linked: boolean,
): boolean {
  if (linked) return true;
  return isActionableEmailCategory(category);
}

/** Default filter grouping "Action" inbox tab. */
export const ACTION_INBOX_FILTER_CATEGORIES = ACTIONABLE_EMAIL_CATEGORIES;
