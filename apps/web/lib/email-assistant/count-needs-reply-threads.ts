import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ACTIONABLE_EMAIL_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';
import {
  applyGoogleConnectionScope,
  isBusinessMailboxUnscoped,
} from '~/lib/email-assistant/google-connection-scope';
import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

/**
 * Count threads marked actionable (reply_now / reply_later) for a mailbox.
 * Business mailboxes are scoped to a workspace connection.
 */
export async function countNeedsReplyEmailThreads(
  client: SupabaseClient,
  params: {
    userId: string;
    mailboxKind: MailboxKind;
    accountId?: string | null;
  },
): Promise<number> {
  if (isBusinessMailboxUnscoped(params.mailboxKind, params.accountId)) {
    return 0;
  }

  const { data: connection, error: connectionError } =
    await applyGoogleConnectionScope(
      client.from('google_connections').select('id'),
      params,
    ).maybeSingle();

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
