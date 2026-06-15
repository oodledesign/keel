import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

type DynamicQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select: (columns: string) => DynamicQuery;
  eq: (column: string, value: string) => DynamicQuery;
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

export async function loadAssistantSettings(userId: string) {
  const { data, error } = await adminTable('email_assistant_settings')
    .select('user_id, last_history_id, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        user_id: string;
        last_history_id: string | null;
        last_synced_at: string | null;
      }
    | null;
}

export async function saveAssistantCursor(
  userId: string,
  historyId: string | null,
) {
  const now = new Date().toISOString();
  const { error } = await adminTable('email_assistant_settings')
    .upsert(
      {
        user_id: userId,
        last_history_id: historyId,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertEmailThread(input: {
  userId: string;
  gmailThreadId: string;
  subject: string | null;
  participants: Array<{ name: string | null; email: string }>;
  snippet: string | null;
  labelIds: string[];
  isUnread: boolean;
  lastMessageAt: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await adminTable('email_threads')
    .upsert(
      {
        user_id: input.userId,
        gmail_thread_id: input.gmailThreadId,
        subject: input.subject,
        participants: input.participants,
        snippet: input.snippet,
        label_ids: input.labelIds,
        is_unread: input.isUnread,
        last_message_at: input.lastMessageAt,
        updated_at: now,
      },
      { onConflict: 'user_id,gmail_thread_id' },
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
      { onConflict: 'user_id,gmail_message_id' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteEmailMessage(userId: string, gmailMessageId: string) {
  const query = adminTable('email_messages')
    .delete()
    .eq('user_id', userId)
    .eq('gmail_message_id', gmailMessageId) as unknown as Promise<{
    error: { message: string } | null;
  }>;

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}
