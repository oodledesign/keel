import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';
import { ACTIONABLE_EMAIL_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';

/**
 * Count threads marked actionable (reply_now / reply_later) for a user's Gmail connection.
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
    .in('assistant_category', [...ACTIONABLE_EMAIL_CATEGORIES]);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
