import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { looseClient } from './loose-client';

export async function skipPendingRetainerMatch(actionItemId: string) {
  await skipPendingRetainerMatches([actionItemId]);
}

export async function skipPendingRetainerMatches(actionItemIds: string[]) {
  if (actionItemIds.length === 0) return;
  await looseClient(getSupabaseServerAdminClient())
    .from('retainer_match_suggestions')
    .update({ status: 'skipped' })
    .in('email_action_item_id', actionItemIds)
    .eq('status', 'pending');
}

export async function skipPendingRetainerMatchesForThreads(
  threadIds: string[],
) {
  if (threadIds.length === 0) return;
  await looseClient(getSupabaseServerAdminClient())
    .from('retainer_match_suggestions')
    .update({ status: 'skipped' })
    .in('email_thread_id', threadIds)
    .eq('status', 'pending');
}
