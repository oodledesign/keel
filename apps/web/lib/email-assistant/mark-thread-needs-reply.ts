import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

/**
 * Manually marks a thread as needing a reply. Ownership is required.
 * Does not re-run LLM triage; next sync keeps this until a new tip message arrives.
 */
export async function markEmailThreadNeedsReply(
  client: SupabaseClient,
  userId: string,
  threadId: string,
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

  if (existing.assistant_category === 'needs_reply') {
    return;
  }

  const { error } = await client
    .from('email_threads')
    .update({
      assistant_category: 'needs_reply',
      assistant_category_reason: 'Manually marked as needs reply',
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  queueEmailThreadBrainSync(threadId);
}
