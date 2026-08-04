import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractEmailAddress } from './address-utils';

export type IgnoreEmailScope = 'sender' | 'domain';

export type EmailIgnoreLists = {
  senders: string[];
  domains: string[];
};

export function extractEmailDomain(
  value: string | null | undefined,
): string | null {
  const email = extractEmailAddress(value);

  if (!email) {
    return null;
  }

  const at = email.lastIndexOf('@');

  if (at <= 0 || at === email.length - 1) {
    return null;
  }

  return email.slice(at + 1).toLowerCase();
}

export function normalizeIgnoredSenders(
  values: Array<string | null | undefined> | null | undefined,
): string[] {
  const unique = new Set<string>();

  for (const value of values ?? []) {
    const email = extractEmailAddress(value);

    if (email) {
      unique.add(email);
    }
  }

  return [...unique].sort();
}

export function normalizeIgnoredDomains(
  values: Array<string | null | undefined> | null | undefined,
): string[] {
  const unique = new Set<string>();

  for (const value of values ?? []) {
    if (!value?.trim()) {
      continue;
    }

    const trimmed = value.trim().toLowerCase().replace(/^@+/, '');

    // Plain domain or a full address — store the domain only.
    const domain = trimmed.includes('@')
      ? extractEmailDomain(trimmed)
      : trimmed.includes('.')
        ? trimmed
        : null;

    if (domain) {
      unique.add(domain);
    }
  }

  return [...unique].sort();
}

export function isAddressIgnored(
  fromAddress: string | null | undefined,
  lists: EmailIgnoreLists | null | undefined,
): boolean {
  const from = extractEmailAddress(fromAddress);

  if (!from || !lists) {
    return false;
  }

  if (lists.senders.some((ignored) => extractEmailAddress(ignored) === from)) {
    return true;
  }

  const domain = extractEmailDomain(from);

  if (!domain || lists.domains.length === 0) {
    return false;
  }

  return lists.domains.some(
    (ignored) => normalizeIgnoredDomains([ignored])[0] === domain,
  );
}

/** @deprecated Prefer isAddressIgnored — kept for call-site migration. */
export function isSenderIgnored(
  fromAddress: string | null | undefined,
  ignoredSenders: string[] | null | undefined,
): boolean {
  return isAddressIgnored(fromAddress, {
    senders: ignoredSenders ?? [],
    domains: [],
  });
}

/**
 * Ignore a sender or whole domain for this mailbox: persist the rule, mark
 * matching threads as no_reply, and dismiss pending suggested action items.
 */
export async function ignoreEmailRuleAndDismissSuggestions(
  client: SupabaseClient,
  userId: string,
  actionItemId: string,
  scope: IgnoreEmailScope,
): Promise<{ value: string; scope: IgnoreEmailScope; dismissedCount: number }> {
  const { data: actionItem, error: actionError } = await client
    .from('email_action_items')
    .select(
      `
      id,
      thread_id,
      message_id,
      email_threads:thread_id ( id, connection_id ),
      email_messages:message_id ( from_address )
    `,
    )
    .eq('id', actionItemId)
    .eq('user_id', userId)
    .maybeSingle();

  if (actionError) {
    throw new Error(actionError.message);
  }

  if (!actionItem) {
    throw new Error('This suggestion is no longer available');
  }

  const thread = unwrapOne(actionItem.email_threads as unknown);
  const message = unwrapOne(actionItem.email_messages as unknown);
  const connectionId =
    typeof thread?.connection_id === 'string' ? thread.connection_id : null;

  if (!connectionId) {
    throw new Error('Could not resolve mailbox for this suggestion');
  }

  let sender = extractEmailAddress(
    typeof message?.from_address === 'string' ? message.from_address : null,
  );

  if (!sender) {
    const { data: latestMessage, error: latestError } = await client
      .from('email_messages')
      .select('from_address')
      .eq('thread_id', actionItem.thread_id)
      .eq('user_id', userId)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw new Error(latestError.message);
    }

    sender = extractEmailAddress(
      (latestMessage as { from_address?: string | null } | null)?.from_address,
    );
  }

  if (!sender) {
    throw new Error('Could not determine the sender for this suggestion');
  }

  const domain = extractEmailDomain(sender);

  if (scope === 'domain' && !domain) {
    throw new Error('Could not determine the sender domain');
  }

  const value = scope === 'domain' ? domain! : sender;

  const { data: settings, error: settingsError } = await client
    .from('email_assistant_settings')
    .select('ignored_senders, ignored_domains')
    .eq('connection_id', connectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const current = settings as {
    ignored_senders?: string[] | null;
    ignored_domains?: string[] | null;
  } | null;

  const nextSenders = normalizeIgnoredSenders([
    ...(current?.ignored_senders ?? []),
    ...(scope === 'sender' ? [value] : []),
  ]);
  const nextDomains = normalizeIgnoredDomains([
    ...(current?.ignored_domains ?? []),
    ...(scope === 'domain' ? [value] : []),
  ]);

  const { error: upsertError } = await client
    .from('email_assistant_settings')
    .upsert(
      {
        user_id: userId,
        connection_id: connectionId,
        ignored_senders: nextSenders,
        ignored_domains: nextDomains,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'connection_id' },
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const lists: EmailIgnoreLists =
    scope === 'domain'
      ? { senders: [], domains: [value] }
      : { senders: [value], domains: [] };

  const dismissedCount = await dismissSuggestedItemsMatchingIgnore(
    client,
    userId,
    connectionId,
    lists,
    scope === 'domain'
      ? `Domain ignored (${value})`
      : `Sender ignored (${value})`,
  );

  return { value, scope, dismissedCount };
}

/** @deprecated Prefer ignoreEmailRuleAndDismissSuggestions(…, 'sender') */
export async function ignoreEmailSenderAndDismissSuggestions(
  client: SupabaseClient,
  userId: string,
  actionItemId: string,
): Promise<{ sender: string; dismissedCount: number }> {
  const result = await ignoreEmailRuleAndDismissSuggestions(
    client,
    userId,
    actionItemId,
    'sender',
  );

  return { sender: result.value, dismissedCount: result.dismissedCount };
}

export async function removeIgnoredEmailRule(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
  scope: IgnoreEmailScope,
  value: string,
): Promise<EmailIgnoreLists> {
  const { data: settings, error: settingsError } = await client
    .from('email_assistant_settings')
    .select('ignored_senders, ignored_domains')
    .eq('connection_id', connectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const current = settings as {
    ignored_senders?: string[] | null;
    ignored_domains?: string[] | null;
  } | null;

  let nextSenders = normalizeIgnoredSenders(current?.ignored_senders ?? []);
  let nextDomains = normalizeIgnoredDomains(current?.ignored_domains ?? []);

  if (scope === 'sender') {
    const normalized = extractEmailAddress(value);

    if (!normalized) {
      throw new Error('Invalid email address');
    }

    nextSenders = nextSenders.filter((email) => email !== normalized);
  } else {
    const normalized = normalizeIgnoredDomains([value])[0];

    if (!normalized) {
      throw new Error('Invalid domain');
    }

    nextDomains = nextDomains.filter((domain) => domain !== normalized);
  }

  const { error: updateError } = await client
    .from('email_assistant_settings')
    .update({
      ignored_senders: nextSenders,
      ignored_domains: nextDomains,
      updated_at: new Date().toISOString(),
    })
    .eq('connection_id', connectionId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { senders: nextSenders, domains: nextDomains };
}

/** @deprecated Prefer removeIgnoredEmailRule(…, 'sender', …) */
export async function removeIgnoredEmailSender(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
  sender: string,
): Promise<string[]> {
  const lists = await removeIgnoredEmailRule(
    client,
    userId,
    connectionId,
    'sender',
    sender,
  );

  return lists.senders;
}

async function dismissSuggestedItemsMatchingIgnore(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
  lists: EmailIgnoreLists,
  reason: string,
): Promise<number> {
  const { data: threads, error: threadsError } = await client
    .from('email_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('connection_id', connectionId);

  if (threadsError) {
    throw new Error(threadsError.message);
  }

  const threadIds = (threads ?? []).map((row) => row.id as string);

  if (threadIds.length === 0) {
    return 0;
  }

  const { data: suggested, error: suggestedError } = await client
    .from('email_action_items')
    .select(
      `
      id,
      thread_id,
      message_id,
      email_messages:message_id ( from_address )
    `,
    )
    .eq('user_id', userId)
    .eq('status', 'suggested')
    .in('thread_id', threadIds);

  if (suggestedError) {
    throw new Error(suggestedError.message);
  }

  const rows = suggested ?? [];
  const threadIdsNeedingTip = [
    ...new Set(
      rows
        .filter((row) => {
          const linked = unwrapOne(row.email_messages as unknown);
          return !(
            typeof linked?.from_address === 'string' && linked.from_address
          );
        })
        .map((row) => row.thread_id as string),
    ),
  ];

  const tipByThread = new Map<string, string | null>();

  if (threadIdsNeedingTip.length > 0) {
    const { data: tipMessages, error: tipsError } = await client
      .from('email_messages')
      .select('thread_id, from_address')
      .eq('user_id', userId)
      .in('thread_id', threadIdsNeedingTip)
      .order('internal_date', { ascending: false, nullsFirst: false });

    if (tipsError) {
      throw new Error(tipsError.message);
    }

    for (const tip of tipMessages ?? []) {
      const threadId = tip.thread_id as string;

      if (tipByThread.has(threadId)) {
        continue;
      }

      tipByThread.set(threadId, (tip.from_address as string | null) ?? null);
    }
  }

  const dismissIds: string[] = [];
  const matchingThreadIds = new Set<string>();

  for (const row of rows) {
    const linked = unwrapOne(row.email_messages as unknown);
    const linkedFrom =
      typeof linked?.from_address === 'string' ? linked.from_address : null;
    const tipFrom = tipByThread.get(row.thread_id as string) ?? null;
    const from = linkedFrom ?? tipFrom;

    if (isAddressIgnored(from, lists)) {
      dismissIds.push(row.id as string);
      matchingThreadIds.add(row.thread_id as string);
    }
  }

  if (matchingThreadIds.size > 0) {
    const { error: threadUpdateError } = await client
      .from('email_threads')
      .update({
        assistant_category: 'no_reply',
        assistant_category_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('id', [...matchingThreadIds]);

    if (threadUpdateError) {
      throw new Error(threadUpdateError.message);
    }
  }

  if (dismissIds.length === 0) {
    return 0;
  }

  const { error: dismissError } = await client
    .from('email_action_items')
    .update({ status: 'dismissed' })
    .eq('user_id', userId)
    .eq('status', 'suggested')
    .in('id', dismissIds);

  if (dismissError) {
    throw new Error(dismissError.message);
  }

  return dismissIds.length;
}

function unwrapOne(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }

  return value as Record<string, unknown>;
}
