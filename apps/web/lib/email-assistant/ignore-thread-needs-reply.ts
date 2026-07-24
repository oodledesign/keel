import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

/**
 * Marks a needs_reply thread as no_reply. Ownership is required; workspace
 * membership is validated by the caller when accountId is supplied.
 */
export async function ignoreEmailThreadNeedsReply(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  _accountId?: string,
) {
  const { data: existing, error: loadError } = await client
    .from('email_threads')
    .select('id, assistant_category')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!existing) {
    throw new Error('Thread not found');
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
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  queueEmailThreadBrainSync(threadId);
}
