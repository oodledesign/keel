import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { type EmailActionItem, extract } from '@kit/email-assistant';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';

import {
  loadAccountMembersForExtraction,
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from './account-members';
import { linkFieldsFromThread } from './action-item-links';
import { createMeteredEmailGenerateText } from './metered-generate-text';
import { buildThreadText } from './thread-text';

/**
 * Extract concrete action items from a needs_reply thread into the suggested holding list.
 * Skips when non-dismissed suggestions already exist for the thread.
 */
export async function autoExtractEmailActionItems(params: {
  admin: SupabaseClient;
  userId: string;
  threadId: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
  preferredAccountId?: string | null;
}): Promise<number> {
  const {
    admin,
    userId,
    threadId,
    ownerEmail,
    ownerDisplayName,
    preferredAccountId,
  } = params;

  const { count: existingCount, error: existingError } = await admin
    .from('email_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .neq('status', 'dismissed');

  if (existingError) {
    throw new Error(existingError.message);
  }

  if ((existingCount ?? 0) > 0) {
    return 0;
  }

  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select('id, account_id, client_id, project_id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return 0;
  }

  const { data: messages, error: messagesError } = await admin
    .from('email_messages')
    .select(
      'id, from_address, subject, body_text, snippet, internal_date, created_at',
    )
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .order('internal_date', { ascending: true, nullsFirst: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const threadText = buildThreadText(messages ?? []);
  if (!threadText.trim()) {
    return 0;
  }

  const accountId =
    (thread as { account_id?: string | null }).account_id ||
    preferredAccountId ||
    null;
  const accountMembers = accountId
    ? await loadAccountMembersForExtraction(admin, accountId)
    : [];

  let items: EmailActionItem[];
  try {
    items = await extract(
      threadText,
      todayLocalYmd(),
      {
        mailboxOwnerEmail: ownerEmail,
        mailboxOwnerName: ownerDisplayName,
        accountMembers,
      },
      createMeteredEmailGenerateText({
        feature: 'task_extract',
        accountId: userId,
        supabase: admin,
      }),
    );
  } catch {
    return 0;
  }

  const filteredItems = items.filter((item) =>
    shouldIncludeExtractedItem(item, accountMembers, ownerEmail),
  );

  if (filteredItems.length === 0) {
    return 0;
  }

  const threadLink = linkFieldsFromThread(
    thread as {
      account_id?: string | null;
      client_id?: string | null;
      project_id?: string | null;
    },
  );

  const latestMessageId =
    (messages?.at(-1) as { id?: string } | undefined)?.id ?? null;

  const rows = filteredItems.map((item) => ({
    user_id: userId,
    thread_id: threadId,
    message_id: latestMessageId,
    title: item.title,
    detail: item.detail,
    suggested_due_date: item.suggestedDueDate,
    source_excerpt: item.sourceExcerpt,
    assignee_confidence: item.assigneeConfidence,
    suggested_assignee_id: resolveSuggestedAssigneeId(
      item,
      accountMembers,
      ownerEmail,
    ),
    account_id: threadLink.accountId ?? preferredAccountId ?? null,
    client_id: threadLink.clientId,
    project_id: threadLink.projectId,
    status: 'suggested',
  }));

  const { data: inserted, error: insertError } = await admin
    .from('email_action_items')
    .insert(rows)
    .select('id');

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted?.length ?? 0;
}
