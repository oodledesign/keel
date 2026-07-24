import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';
import { isFromOwner } from '~/lib/email-assistant/address-utils';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';

/**
 * Clears `needs_reply` when the latest synced message is already from the mailbox owner
 * (e.g. they replied in Gmail outside Ozer).
 */
export async function reconcileRepliedNeedsReplyThreads(params: {
  userId?: string;
  accountId?: string;
  connectionId?: string;
  threadIds?: string[];
}): Promise<{ cleared: number }> {
  const admin = getSupabaseServerAdminClient();

  let query = admin
    .from('email_threads')
    .select('id, user_id')
    .eq('assistant_category', 'needs_reply');

  if (params.threadIds && params.threadIds.length > 0) {
    query = query.in('id', params.threadIds);
  } else if (params.connectionId) {
    query = query.eq('connection_id', params.connectionId);
  } else if (params.accountId) {
    query = query.eq('account_id', params.accountId);
  } else if (params.userId) {
    query = query.eq('user_id', params.userId);
  } else {
    return { cleared: 0 };
  }

  const { data: threads, error } = await query.limit(50);

  if (error || !threads?.length) {
    return { cleared: 0 };
  }

  const ownerByUserId = new Map<string, string>();
  let cleared = 0;

  for (const row of threads) {
    const threadId = row.id as string;
    const mailboxUserId = row.user_id as string;

    let ownerEmail = ownerByUserId.get(mailboxUserId);
    if (!ownerEmail) {
      const owner = await resolveDraftOwnerContext(mailboxUserId);
      if (!owner) {
        continue;
      }
      ownerEmail = owner.email;
      ownerByUserId.set(mailboxUserId, ownerEmail);
    }

    const { data: latest, error: latestError } = await admin
      .from('email_messages')
      .select('id, from_address')
      .eq('thread_id', threadId)
      .eq('user_id', mailboxUserId)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestError || !latest) {
      continue;
    }

    if (!isFromOwner(latest.from_address as string | null, ownerEmail)) {
      continue;
    }

    const { error: updateError } = await admin
      .from('email_threads')
      .update({
        assistant_category: 'no_reply',
        assistant_category_reason: 'Latest message is from you',
        assistant_processed_message_id: latest.id as string,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', mailboxUserId);

    if (updateError) {
      continue;
    }

    cleared += 1;
    queueEmailThreadBrainSync(threadId);
  }

  return { cleared };
}
