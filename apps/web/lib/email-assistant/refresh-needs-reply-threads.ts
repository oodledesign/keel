import 'server-only';

import { syncGmailThread } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';
import { reconcileRepliedNeedsReplyThreads } from '~/lib/email-assistant/reconcile-replied-threads';

/**
 * Pulls the latest Gmail state for `needs_reply` threads, then clears any that
 * were already answered outside Ozer (e.g. replied in Gmail).
 */
export async function refreshAndReconcileNeedsReplyThreads(params: {
  accountId?: string;
  userId?: string;
  limit?: number;
}): Promise<{ refreshed: number; cleared: number }> {
  if (!params.accountId && !params.userId) {
    return { refreshed: 0, cleared: 0 };
  }

  const admin = getSupabaseServerAdminClient();
  const limit = params.limit ?? 12;

  let query = admin
    .from('email_threads')
    .select('id, user_id, gmail_thread_id')
    .eq('assistant_category', 'needs_reply')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (params.accountId) {
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
    threadIds,
  });

  return { refreshed, cleared: clearedViaSent + cleared };
}
