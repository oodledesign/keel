import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

/**
 * Count threads marked needs_reply for a user's Gmail connection.
 */
export async function countNeedsReplyEmailThreads(
  client: SupabaseClient,
  params: { userId: string; mailboxKind: MailboxKind },
): Promise<number> {
  const { data: connection, error: connectionError } = await client
    .from('google_connections')
    .select('id')
    .eq('user_id', params.userId)
    .eq('mailbox_kind', params.mailboxKind)
    .maybeSingle();

  if (connectionError) {
    throw connectionError;
  }

  const connectionId = (connection as { id?: string } | null)?.id;
  if (!connectionId) {
    return 0;
  }

  const { count, error } = await client
    .from('email_threads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)
    .eq('connection_id', connectionId)
    .eq('assistant_category', 'needs_reply');

  if (error) {
    throw error;
  }

  return count ?? 0;
}
