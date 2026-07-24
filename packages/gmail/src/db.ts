import 'server-only';

import type { MailboxKind } from '@kit/google-auth';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

type DynamicQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns: string) => DynamicQuery;
  eq: (column: string, value: string) => DynamicQuery;
  in: (column: string, values: string[]) => DynamicQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  single: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  delete: () => DynamicQuery;
};

type DynamicTable = {
  select: (columns: string) => DynamicQuery;
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => DynamicQuery;
  update: (values: Record<string, unknown>) => DynamicQuery;
  delete: () => DynamicQuery;
};

function adminTable(name: string) {
  return (
    getSupabaseServerAdminClient() as unknown as {
      from: (table: string) => DynamicTable;
    }
  ).from(name);
}

export async function resolveConnectionId(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<string | null> {
  const { data, error } = await adminTable('google_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id?: string } | null)?.id ?? null;
}

export async function loadAssistantSettings(
  userId: string,
  mailboxKind: MailboxKind = 'business',
) {
  const connectionId = await resolveConnectionId(userId, mailboxKind);

  if (!connectionId) {
    return null;
  }

  const { data, error } = await adminTable('email_assistant_settings')
    .select('user_id, connection_id, last_history_id, last_synced_at')
    .eq('connection_id', connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    user_id: string;
    connection_id: string;
    last_history_id: string | null;
    last_synced_at: string | null;
  } | null;
}

export async function saveAssistantCursor(
  userId: string,
  historyId: string | null,
  mailboxKind: MailboxKind = 'business',
) {
  const connectionId = await resolveConnectionId(userId, mailboxKind);

  if (!connectionId) {
    throw new Error('Google account is not connected');
  }

  const now = new Date().toISOString();
  const { error } = await adminTable('email_assistant_settings')
    .upsert(
      {
        user_id: userId,
        connection_id: connectionId,
        last_history_id: historyId,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'connection_id' },
    )
    .select('connection_id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
}

export async function touchAssistantSyncTime(
  userId: string,
  mailboxKind: MailboxKind = 'business',
) {
  const settings = await loadAssistantSettings(userId, mailboxKind);
  const connectionId =
    settings?.connection_id ?? (await resolveConnectionId(userId, mailboxKind));

  if (!connectionId) {
    throw new Error('Google account is not connected');
  }

  const now = new Date().toISOString();
  const { error } = await adminTable('email_assistant_settings')
    .upsert(
      {
        user_id: userId,
        connection_id: connectionId,
        last_history_id: settings?.last_history_id ?? null,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'connection_id' },
    )
    .select('connection_id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
}

export async function listSyncedGmailMessageIds(
  userId: string,
  gmailMessageIds: string[],
  connectionId?: string | null,
): Promise<Set<string>> {
  const synced = new Set<string>();

  if (gmailMessageIds.length === 0) {
    return synced;
  }

  const chunkSize = 200;

  for (let offset = 0; offset < gmailMessageIds.length; offset += chunkSize) {
    const chunk = gmailMessageIds.slice(offset, offset + chunkSize);
    let query = adminTable('email_messages')
      .select('gmail_message_id')
      .eq('user_id', userId)
      .in('gmail_message_id', chunk);

    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data as Array<{
      gmail_message_id?: string | null;
    }> | null) ?? []) {
      const id = row.gmail_message_id;
      if (id) {
        synced.add(id);
      }
    }
  }

  return synced;
}

export async function upsertEmailThread(input: {
  userId: string;
  connectionId: string;
  gmailThreadId: string;
  subject: string | null;
  participants: Array<{ name: string | null; email: string }>;
  snippet: string | null;
  labelIds: string[];
  isUnread: boolean;
  lastMessageAt: string | null;
}): Promise<string> {
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await adminTable(
    'email_threads',
  )
    .select('id, last_message_at')
    .eq('connection_id', input.connectionId)
    .eq('gmail_thread_id', input.gmailThreadId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRow = existing as {
    id?: string;
    last_message_at?: string | null;
  } | null;

  let lastMessageAt = input.lastMessageAt;

  if (existingRow?.last_message_at && input.lastMessageAt) {
    lastMessageAt =
      new Date(input.lastMessageAt).getTime() >=
      new Date(existingRow.last_message_at).getTime()
        ? input.lastMessageAt
        : existingRow.last_message_at;
  } else {
    lastMessageAt = input.lastMessageAt ?? existingRow?.last_message_at ?? null;
  }

  const { data, error } = await adminTable('email_threads')
    .upsert(
      {
        user_id: input.userId,
        connection_id: input.connectionId,
        gmail_thread_id: input.gmailThreadId,
        subject: input.subject,
        participants: input.participants,
        snippet: input.snippet,
        label_ids: input.labelIds,
        is_unread: input.isUnread,
        last_message_at: lastMessageAt,
        updated_at: now,
      },
      { onConflict: 'connection_id,gmail_thread_id' },
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function upsertEmailMessage(input: {
  userId: string;
  connectionId: string;
  threadId: string;
  gmailMessageId: string;
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  internalDate: string | null;
}) {
  const { error } = await adminTable('email_messages')
    .upsert(
      {
        user_id: input.userId,
        connection_id: input.connectionId,
        thread_id: input.threadId,
        gmail_message_id: input.gmailMessageId,
        from_address: input.fromAddress,
        to_addresses: input.toAddresses,
        cc_addresses: input.ccAddresses,
        subject: input.subject,
        snippet: input.snippet,
        body_text: input.bodyText,
        body_html: input.bodyHtml,
        internal_date: input.internalDate,
      },
      { onConflict: 'connection_id,gmail_message_id' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteEmailMessage(
  userId: string,
  gmailMessageId: string,
  connectionId?: string | null,
) {
  let query = adminTable('email_messages')
    .delete()
    .eq('user_id', userId)
    .eq('gmail_message_id', gmailMessageId);

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { error } = await (query as unknown as Promise<{
    error: { message: string } | null;
  }>);

  if (error) {
    throw new Error(error.message);
  }
}
