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
  clientId: string | null;
  clientName: string | null;
  clientPictureUrl: string | null;
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
      client_id,
      clients:client_id (
        id,
        display_name,
        company_name,
        first_name,
        last_name,
        picture_url
      ),
      email_threads:thread_id ( subject, last_message_at, client_id ),
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
    const linkedClient = unwrapOne(row.clients);
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

    const clientId =
      (row.client_id as string | null) ??
      (typeof thread?.client_id === 'string' ? thread.client_id : null) ??
      (typeof linkedClient?.id === 'string' ? linkedClient.id : null);

    const clientName = resolveClientDisplayName(linkedClient);
    const clientPictureUrl =
      typeof linkedClient?.picture_url === 'string' &&
      linkedClient.picture_url.trim()
        ? linkedClient.picture_url.trim()
        : null;

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
      clientId,
      clientName,
      clientPictureUrl,
    };
  });

  // Resolve thread-linked clients when the action item itself has no client join.
  const missingClientIds = [
    ...new Set(
      items
        .filter((item) => item.clientId && !item.clientName)
        .map((item) => item.clientId as string),
    ),
  ];

  if (missingClientIds.length > 0) {
    const { data: clientRows } = await client
      .from('clients')
      .select(
        'id, display_name, company_name, first_name, last_name, picture_url',
      )
      .in('id', missingClientIds);

    const byId = new Map(
      (clientRows ?? []).map((row) => {
        const name =
          (row.display_name as string | null)?.trim() ||
          (row.company_name as string | null)?.trim() ||
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          null;
        return [
          row.id as string,
          {
            name,
            pictureUrl: (row.picture_url as string | null)?.trim() || null,
          },
        ] as const;
      }),
    );

    for (const item of items) {
      if (!item.clientId || item.clientName) continue;
      const match = byId.get(item.clientId);
      if (!match) continue;
      item.clientName = match.name;
      item.clientPictureUrl = match.pictureUrl;
    }
  }

  return { items, totalCount: count ?? items.length };
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

function resolveClientDisplayName(
  client: Record<string, unknown> | null,
): string | null {
  if (!client) return null;

  const displayName =
    typeof client.display_name === 'string' ? client.display_name.trim() : '';
  if (displayName) return displayName;

  const companyName =
    typeof client.company_name === 'string' ? client.company_name.trim() : '';
  if (companyName) return companyName;

  const fullName = [client.first_name, client.last_name]
    .filter(
      (part): part is string =>
        typeof part === 'string' && Boolean(part.trim()),
    )
    .join(' ')
    .trim();

  return fullName || null;
}
