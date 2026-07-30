import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ensureNeedsReplyWorkspaceAffinity } from '~/lib/email-assistant/needs-reply-workspace-affinity';

import { shouldIndexEmailThreadForBrain } from './email-thread-index';
import { queueBrainDeleteSource, queueBrainIndexSource } from './sync';

export async function syncEmailThreadToBrain(
  threadId: string,
  options?: { preferredAccountId?: string | null },
) {
  const admin = getSupabaseServerAdminClient();

  const { data: thread, error } = await admin
    .from('email_threads')
    .select(
      'id, user_id, account_id, assistant_category, client_id, project_id',
    )
    .eq('id', threadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread?.user_id) {
    queueBrainDeleteSource(threadId);
    return;
  }

  let accountId = (thread.account_id as string | null) ?? null;

  if (
    !accountId &&
    thread.assistant_category === 'needs_reply' &&
    !(thread.client_id || thread.project_id)
  ) {
    accountId = await ensureNeedsReplyWorkspaceAffinity(admin, {
      userId: thread.user_id as string,
      threadId,
      preferredAccountId: options?.preferredAccountId,
    });
  }

  const indexable = shouldIndexEmailThreadForBrain({
    account_id: accountId,
    assistant_category: thread.assistant_category as string | null,
    client_id: thread.client_id as string | null,
    project_id: thread.project_id as string | null,
  });

  if (!accountId || !indexable) {
    queueBrainDeleteSource(threadId);
    return;
  }

  queueBrainIndexSource(accountId, 'email_thread', threadId);
}

export function queueEmailThreadBrainSync(
  threadId: string,
  preferredAccountId?: string | null,
) {
  void syncEmailThreadToBrain(threadId, { preferredAccountId }).catch((err) => {
    console.error('[brain] email thread sync failed', {
      threadId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
