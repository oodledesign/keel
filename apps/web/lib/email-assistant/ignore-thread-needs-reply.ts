import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

export async function ignoreEmailThreadNeedsReply(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  accountId: string,
) {
  const { data: existing, error: loadError } = await client
    .from('email_threads')
    .select('id, account_id, assistant_category')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!existing) {
    throw new Error('Thread not found');
  }

  if (existing.account_id !== accountId) {
    throw new Error('Thread is not linked to this workspace');
  }

  if (existing.assistant_category !== 'needs_reply') {
    return;
  }

  const { error } = await client
    .from('email_threads')
    .update({
      assistant_category: 'no_reply',
      assistant_category_reason: 'Ignored — no reply needed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId)
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  queueEmailThreadBrainSync(threadId);
}
