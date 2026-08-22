import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

import type { EmailThreadCategory } from './email-thread-categories';

export async function setEmailThreadCategory(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  category: EmailThreadCategory,
  reason: string,
  options?: { confidence?: number | null },
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

  const { error } = await client
    .from('email_threads')
    .update({
      assistant_category: category,
      assistant_category_reason: reason,
      assistant_category_confidence:
        options?.confidence === undefined ? null : options.confidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  queueEmailThreadBrainSync(threadId);
}

export async function markEmailThreadNeedsReply(
  client: SupabaseClient,
  userId: string,
  threadId: string,
) {
  await setEmailThreadCategory(
    client,
    userId,
    threadId,
    'reply_now',
    'Manually marked as needs reply',
    { confidence: 1 },
  );
}

export async function ignoreEmailThreadNeedsReply(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  _accountId?: string,
) {
  await setEmailThreadCategory(
    client,
    userId,
    threadId,
    'noise',
    'Ignored — no reply needed',
    { confidence: 1 },
  );
}
