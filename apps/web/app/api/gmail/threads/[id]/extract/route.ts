import { type EmailActionItem, extract } from '@kit/email-assistant';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import {
  loadAccountMembersForExtraction,
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from '~/lib/email-assistant/account-members';
import { linkFieldsFromThread } from '~/lib/email-assistant/action-item-links';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { buildThreadText } from '~/lib/email-assistant/thread-text';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  let instructions: string | undefined;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { instructions?: unknown };
      if (typeof body.instructions === 'string') {
        const trimmed = body.instructions.trim();
        if (trimmed) instructions = trimmed.slice(0, 2000);
      }
    } catch {
      // Empty body is fine for refresh without custom instructions.
    }
  }

  const { id: threadId } = await context.params;

  const { data: thread, error: threadError } = await auth.client
    .from('email_threads')
    .select(
      'id, user_id, subject, account_id, client_id, project_id, connection_id',
    )
    .eq('id', threadId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const connectionId = (thread as { connection_id?: string | null })
    .connection_id;

  let mailboxKind: 'business' | 'personal' = 'business';
  if (connectionId) {
    const { data: connection } = await auth.client
      .from('google_connections')
      .select('mailbox_kind')
      .eq('id', connectionId)
      .maybeSingle();
    const kind = (connection as { mailbox_kind?: string } | null)?.mailbox_kind;
    if (kind === 'personal' || kind === 'business') {
      mailboxKind = kind;
    }
  }

  const owner = await resolveDraftOwnerContext(auth.user.id, mailboxKind);

  if (!owner) {
    return jsonErr('OWNER_UNKNOWN', 'Could not resolve mailbox owner', 500);
  }

  const accountId = (thread as { account_id?: string | null }).account_id;
  const threadLink = linkFieldsFromThread(
    thread as {
      account_id?: string | null;
      client_id?: string | null;
      project_id?: string | null;
    },
  );
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
    return jsonErr(
      'EMPTY_THREAD',
      'Thread has no message content to analyze',
      400,
    );
  }

  let items: EmailActionItem[];

  try {
    items = await extract(threadText, todayLocalYmd(), {
      mailboxOwnerEmail: owner.email,
      mailboxOwnerName: owner.displayName,
      accountMembers,
      instructions,
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
    account_id: threadLink.accountId,
    client_id: threadLink.clientId,
    project_id: threadLink.projectId,
    status: 'suggested',
  }));

  const { data: inserted, error: insertError } = await auth.client
    .from('email_action_items')
    .insert(rows)
    .select(
      'id, thread_id, message_id, title, detail, suggested_due_date, source_excerpt, assignee_confidence, suggested_assignee_id, account_id, client_id, project_id, status, created_at',
    );

  if (insertError) {
    return jsonErr('INSERT_FAILED', insertError.message, 500);
  }

  return jsonOk({ items: inserted ?? [] });
}
