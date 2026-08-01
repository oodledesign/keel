import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type SuggestedEmailTaskItem = {
  id: string;
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
  threadId: string;
  threadSubject: string;
  createdAt: string;
};

export async function loadSuggestedEmailActionItems(
  client: SupabaseClient,
  userId: string,
  options?: { accountId?: string | null; limit?: number },
): Promise<{ items: SuggestedEmailTaskItem[]; totalCount: number }> {
  const limit = options?.limit ?? 8;
  let query = client
    .from('email_action_items')
    .select(
      'id, title, detail, suggested_due_date, thread_id, created_at, email_threads:thread_id ( subject )',
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .eq('status', 'suggested')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.accountId) {
    query = query.eq('account_id', options.accountId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[email] suggested action items', error.message);
    return { items: [], totalCount: 0 };
  }

  const items: SuggestedEmailTaskItem[] = (data ?? []).map((row) => {
    const thread = row.email_threads as
      | { subject?: string | null }
      | { subject?: string | null }[]
      | null;
    const subject = Array.isArray(thread)
      ? thread[0]?.subject
      : thread?.subject;

    return {
      id: row.id as string,
      title: ((row.title as string | null) ?? 'Task').trim() || 'Task',
      detail: (row.detail as string | null)?.trim() || null,
      suggestedDueDate: (row.suggested_due_date as string | null) ?? null,
      threadId: row.thread_id as string,
      threadSubject: subject?.trim() || '(no subject)',
      createdAt: row.created_at as string,
    };
  });

  return { items, totalCount: count ?? items.length };
}
