import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

export type GoogleConnectionLookup = {
  userId: string;
  mailboxKind: MailboxKind;
  accountId?: string | null;
};

/**
 * Business Gmail is workspace-scoped. Without an account id we must not
 * fall back to "the user's only business connection" — that is the leak.
 */
export function isBusinessMailboxUnscoped(
  mailboxKind: MailboxKind,
  accountId?: string | null,
): boolean {
  return mailboxKind === 'business' && !accountId?.trim();
}

type ConnectionQuery = {
  eq: (column: string, value: string) => ConnectionQuery;
};

export function applyGoogleConnectionScope<T>(
  query: T,
  lookup: GoogleConnectionLookup,
): T {
  const scoped = query as ConnectionQuery;
  let next = scoped
    .eq('user_id', lookup.userId)
    .eq('mailbox_kind', lookup.mailboxKind);

  if (lookup.mailboxKind === 'business' && lookup.accountId?.trim()) {
    next = next.eq('account_id', lookup.accountId.trim());
  }

  return next as T;
}
