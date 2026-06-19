import { extract, type EmailActionItem } from '@kit/email-assistant';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  loadAccountMembersForExtraction,
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from '~/lib/email-assistant/account-members';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import { buildThreadText } from '~/lib/email-assistant/thread-text';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;

  const { data: thread, error: threadError } = await auth.client
    .from('email_threads')
    .select('id, user_id, subject, account_id')
    .eq('id', threadId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const owner = await resolveDraftOwnerContext(auth.user.id);

  if (!owner) {
    return jsonErr('OWNER_UNKNOWN', 'Could not resolve mailbox owner', 500);
  }

  const accountId = (thread as { account_id?: string | null }).account_id;
  const admin = getSupabaseServerAdminClient();
  const accountMembers = accountId
    ? await loadAccountMembersForExtraction(admin, accountId)
    : [];

  const { data: messages, error: messagesError } = await auth.client
    .from('email_messages')
    .select(
      'id, from_address, subject, body_text, snippet, internal_date, created_at',
    )
    .eq('thread_id', threadId)
    .eq('user_id', auth.user.id)
    .order('internal_date', { ascending: true, nullsFirst: false });

  if (messagesError) {
    return jsonErr('LOAD_FAILED', messagesError.message, 500);
  }

  const threadText = buildThreadText(messages ?? []);

  if (!threadText.trim()) {
    return jsonErr('EMPTY_THREAD', 'Thread has no message content to analyze', 400);
  }

  let items: EmailActionItem[];

  try {
    items = await extract(threadText, todayLocalYmd(), {
      mailboxOwnerEmail: owner.email,
      mailboxOwnerName: owner.displayName,
      accountMembers,
    });
  } catch (error) {
    return jsonErr(
      'EXTRACT_FAILED',
      error instanceof Error ? error.message : 'Extraction failed',
      500,
    );
  }

  const filteredItems = items.filter((item) =>
    shouldIncludeExtractedItem(item, accountMembers, owner.email),
  );

  if (filteredItems.length === 0) {
    return jsonOk({ items: [] });
  }

  const latestMessageId =
    (messages?.at(-1) as { id?: string } | undefined)?.id ?? null;

  const rows = filteredItems.map((item: EmailActionItem) => ({
    user_id: auth.user.id,
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
      owner.email,
    ),
    status: 'suggested',
  }));

  const { data: inserted, error: insertError } = await auth.client
    .from('email_action_items')
    .insert(rows)
    .select(
      'id, thread_id, message_id, title, detail, suggested_due_date, source_excerpt, assignee_confidence, suggested_assignee_id, status, created_at',
    );

  if (insertError) {
    return jsonErr('INSERT_FAILED', insertError.message, 500);
  }

  return jsonOk({ items: inserted ?? [] });
}
