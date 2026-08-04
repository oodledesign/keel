import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractEmailAddress } from './address-utils';
import { extractEmailDomain } from './ignored-senders';

export type SuggestedEmailTaskItem = {
  id: string;
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
  threadId: string;
  threadSubject: string;
  createdAt: string;
  emailSentAt: string | null;
  fromAddress: string | null;
  fromEmail: string | null;
  fromDomain: string | null;
};

export async function loadSuggestedEmailActionItems(
  client: SupabaseClient,
  userId: string,
  options?: { accountId?: string | null; limit?: number },
): Promise<{ items: SuggestedEmailTaskItem[]; totalCount: number }> {
  const limit = options?.limit ?? 8;
  let query = client
    .from('email_action_items')
    .select(
      `
      id,
      title,
      detail,
      suggested_due_date,
      thread_id,
      created_at,
      message_id,
      email_threads:thread_id ( subject, last_message_at ),
      email_messages:message_id ( from_address, internal_date )
    `,
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .eq('status', 'suggested')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.accountId) {
    query = query.eq('account_id', options.accountId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[email] suggested action items', error.message);
    return { items: [], totalCount: 0 };
  }

  const rows = data ?? [];
  const threadIdsNeedingTip = [
    ...new Set(
      rows
        .filter((row) => {
          const message = unwrapOne(row.email_messages);
          return !(
            typeof message?.from_address === 'string' &&
            message.from_address.trim()
          );
        })
        .map((row) => row.thread_id as string),
    ),
  ];

  const tipByThread = new Map<
    string,
    { fromAddress: string | null; internalDate: string | null }
  >();

  if (threadIdsNeedingTip.length > 0) {
    const { data: tipMessages } = await client
      .from('email_messages')
      .select('thread_id, from_address, internal_date')
      .eq('user_id', userId)
      .in('thread_id', threadIdsNeedingTip)
      .order('internal_date', { ascending: false, nullsFirst: false });

    for (const tip of tipMessages ?? []) {
      const threadId = tip.thread_id as string;

      if (tipByThread.has(threadId)) {
        continue;
      }

      tipByThread.set(threadId, {
        fromAddress: (tip.from_address as string | null) ?? null,
        internalDate: (tip.internal_date as string | null) ?? null,
      });
    }
  }

  const items: SuggestedEmailTaskItem[] = rows.map((row) => {
    const thread = unwrapOne(row.email_threads);
    const message = unwrapOne(row.email_messages);
    const tip = tipByThread.get(row.thread_id as string);
    const fromAddress =
      (typeof message?.from_address === 'string'
        ? message.from_address
        : null) ??
      tip?.fromAddress ??
      null;
    const emailSentAt =
      (typeof message?.internal_date === 'string'
        ? message.internal_date
        : null) ??
      tip?.internalDate ??
      (typeof thread?.last_message_at === 'string'
        ? thread.last_message_at
        : null) ??
      null;

    return {
      id: row.id as string,
      title: ((row.title as string | null) ?? 'Task').trim() || 'Task',
      detail: (row.detail as string | null)?.trim() || null,
      suggestedDueDate: (row.suggested_due_date as string | null) ?? null,
      threadId: row.thread_id as string,
      threadSubject:
        (typeof thread?.subject === 'string' ? thread.subject.trim() : '') ||
        '(no subject)',
      createdAt: row.created_at as string,
      emailSentAt,
      fromAddress,
      fromEmail: extractEmailAddress(fromAddress),
      fromDomain: extractEmailDomain(fromAddress),
    };
  });

  return { items, totalCount: count ?? items.length };
}

function unwrapOne(
  value: unknown,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }

  return value as Record<string, unknown>;
}
