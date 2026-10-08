import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** People `userId` has blocked. Empty on error so Messages never breaks over blocks. */
export async function loadBlockedUserIds(
  client: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('chat_user_blocks')
    .select('blocked_user_id')
    .eq('blocker_user_id', userId);

  if (error) {
    console.warn('[chat-blocks] load blocked users failed', error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as Array<{ blocked_user_id: string }>).map(
      (row) => row.blocked_user_id,
    ),
  );
}

/** Of `candidateUserIds`, those who have blocked `senderUserId`. */
export async function loadUsersWhoBlocked(
  client: SupabaseClient,
  senderUserId: string,
  candidateUserIds: string[],
): Promise<Set<string>> {
  if (candidateUserIds.length === 0) return new Set();

  const { data, error } = await client
    .from('chat_user_blocks')
    .select('blocker_user_id')
    .eq('blocked_user_id', senderUserId)
    .in('blocker_user_id', candidateUserIds);

  if (error) {
    console.warn('[chat-blocks] load blockers failed', error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as Array<{ blocker_user_id: string }>).map(
      (row) => row.blocker_user_id,
    ),
  );
}
