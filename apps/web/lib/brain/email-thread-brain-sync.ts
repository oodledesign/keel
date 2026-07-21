import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { shouldIndexEmailThreadForBrain } from './email-thread-index';
import { queueBrainDeleteSource, queueBrainIndexSource } from './sync';

export async function syncEmailThreadToBrain(threadId: string) {
  const admin = getSupabaseServerAdminClient();

  const { data: thread, error } = await admin
    .from('email_threads')
    .select('id, account_id, assistant_category, client_id, project_id')
    .eq('id', threadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread?.account_id || !shouldIndexEmailThreadForBrain(thread)) {
    queueBrainDeleteSource(threadId);
    return;
  }

  queueBrainIndexSource(
    thread.account_id as string,
    'email_thread',
    threadId,
  );
}

export function queueEmailThreadBrainSync(threadId: string) {
  void syncEmailThreadToBrain(threadId).catch((err) => {
    console.error('[brain] email thread sync failed', {
      threadId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
