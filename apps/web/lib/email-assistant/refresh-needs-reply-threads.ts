import 'server-only';

import { syncGmailThread } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';
import { reconcileRepliedNeedsReplyThreads } from '~/lib/email-assistant/reconcile-replied-threads';

/**
 * Pulls the latest Gmail state for `needs_reply` threads, then clears any that
 * were already answered outside Ozer (e.g. replied in Gmail).
 *
 * Prefer calling this from the email inbox / cron — not from the dashboard,
 * where Gmail round-trips can block first paint for 10–20s+.
 */
export async function refreshAndReconcileNeedsReplyThreads(params: {
  accountId?: string;
  userId?: string;
  connectionId?: string;
  mailboxKind?: 'business' | 'personal';
  limit?: number;
  /** Soft deadline; returns whatever finished (0,0 if nothing). Default: no cap. */
  maxMs?: number;
}): Promise<{ refreshed: number; cleared: number }> {
  if (!params.accountId && !params.userId && !params.connectionId) {
    return { refreshed: 0, cleared: 0 };
  }

  if (params.maxMs != null && params.maxMs > 0) {
    return Promise.race([
      refreshAndReconcileNeedsReplyThreadsInner(params),
      new Promise<{ refreshed: number; cleared: number }>((resolve) => {
        setTimeout(() => resolve({ refreshed: 0, cleared: 0 }), params.maxMs);
      }),
    ]);
  }

  return refreshAndReconcileNeedsReplyThreadsInner(params);
}

async function refreshAndReconcileNeedsReplyThreadsInner(params: {
  accountId?: string;
  userId?: string;
  connectionId?: string;
  mailboxKind?: 'business' | 'personal';
  limit?: number;
}): Promise<{ refreshed: number; cleared: number }> {

  const admin = getSupabaseServerAdminClient();
  const limit = params.limit ?? 12;
  const mailboxKind = params.mailboxKind ?? 'business';

  let connectionId = params.connectionId ?? null;

  if (!connectionId && params.userId) {
    const { data: connection } = await admin
      .from('google_connections')
      .select('id')
      .eq('user_id', params.userId)
      .eq('mailbox_kind', mailboxKind)
      .maybeSingle();
    connectionId = (connection as { id?: string } | null)?.id ?? null;
  }

  let query = admin
    .from('email_threads')
    .select('id, user_id, gmail_thread_id')
    .eq('assistant_category', 'needs_reply')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  } else if (params.accountId) {
    query = query.eq('account_id', params.accountId);
  } else if (params.userId) {
    query = query.eq('user_id', params.userId);
  }

  const { data: threads, error } = await query;

  if (error || !threads?.length) {
    return { refreshed: 0, cleared: 0 };
  }

  let refreshed = 0;
  let clearedViaSent = 0;
  const threadIds = threads.map((row) => row.id as string);

  await Promise.all(
    threads.map(async (row) => {
      const threadId = row.id as string;
      const gmailThreadId = row.gmail_thread_id as string | null;
      const mailboxUserId = row.user_id as string;

      if (!gmailThreadId) {
        return;
      }

      try {
        const result = await syncGmailThread(mailboxUserId, gmailThreadId, {
          format: 'metadata',
          mailboxKind,
        });
        refreshed += 1;

        if (!result.latestIsSent) {
          return;
        }

        const { data: latest } = await admin
          .from('email_messages')
          .select('id')
          .eq('thread_id', threadId)
          .eq('user_id', mailboxUserId)
          .order('internal_date', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const { error: updateError } = await admin
          .from('email_threads')
          .update({
            assistant_category: 'no_reply',
            assistant_category_reason: 'Latest message is from you',
            assistant_processed_message_id:
              (latest?.id as string | undefined) ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', threadId)
          .eq('user_id', mailboxUserId)
          .eq('assistant_category', 'needs_reply');

        if (!updateError) {
          clearedViaSent += 1;
          queueEmailThreadBrainSync(threadId);
        }
      } catch {
        // Best-effort: still reconcile from whatever is already synced.
      }
    }),
  );

  const { cleared } = await reconcileRepliedNeedsReplyThreads({
    accountId: params.accountId,
    userId: params.userId,
    connectionId: connectionId ?? undefined,
    threadIds,
  });

  return { refreshed, cleared: clearedViaSent + cleared };
}
