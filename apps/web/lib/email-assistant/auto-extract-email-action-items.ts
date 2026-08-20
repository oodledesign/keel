import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { type EmailActionItem, extract } from '@kit/email-assistant';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { isInsufficientCreditsError } from '~/lib/ai/router';

import {
  loadAccountMembersForExtraction,
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from './account-members';
import { linkFieldsFromThread } from './action-item-links';
import {
  isAddressIgnored,
  normalizeIgnoredDomains,
  normalizeIgnoredSenders,
} from './ignored-senders';
import { createMeteredEmailGenerateText } from './metered-generate-text';
import { buildThreadText } from './thread-text';

/** Minimum thread text length before spending an extract call. */
const MIN_THREAD_TEXT_CHARS = 40;

export type AutoExtractEmailActionItemsResult = {
  /** Number of suggested action items inserted. */
  itemsInserted: number;
  /**
   * True when an AI extract call ran (credits may have been charged).
   * False when skipped before the model (already extracted tip, ignore list, etc.).
   */
  attempted: boolean;
};

/**
 * Extract concrete action items from a needs_reply thread into the suggested holding list.
 * Skips when non-dismissed suggestions already exist, or when this message tip was
 * already extracted (including empty results).
 */
export async function autoExtractEmailActionItems(params: {
  admin: SupabaseClient;
  userId: string;
  threadId: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
  preferredAccountId?: string | null;
  /** Workspace to bill AI against (business mailbox). Defaults to userId. */
  billingAccountId?: string | null;
}): Promise<AutoExtractEmailActionItemsResult> {
  const {
    admin,
    userId,
    threadId,
    ownerEmail,
    ownerDisplayName,
    preferredAccountId,
    billingAccountId,
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

  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select(
      'id, account_id, client_id, project_id, connection_id, assistant_extract_message_id',
    )
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return { itemsInserted: 0, attempted: false };
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

  const latestMessageId =
    (messages?.at(-1) as { id?: string } | undefined)?.id ?? null;

  if (!latestMessageId) {
    return { itemsInserted: 0, attempted: false };
  }

  if ((existingCount ?? 0) > 0) {
    // Suggestions already exist — stamp tip so sync stops re-checking forever.
    if (
      (thread as { assistant_extract_message_id?: string | null })
        .assistant_extract_message_id !== latestMessageId
    ) {
      await stampExtractTip(admin, {
        threadId,
        userId,
        messageId: latestMessageId,
      });
    }
    return { itemsInserted: 0, attempted: false };
  }

  const priorExtractTip = (
    thread as { assistant_extract_message_id?: string | null }
  ).assistant_extract_message_id;

  if (priorExtractTip === latestMessageId) {
    return { itemsInserted: 0, attempted: false };
  }

  const connectionId = (thread as { connection_id?: string | null })
    .connection_id;

  if (connectionId) {
    const { data: settingsRow } = await admin
      .from('email_assistant_settings')
      .select('ignored_senders, ignored_domains')
      .eq('connection_id', connectionId)
      .maybeSingle();

    const settings = settingsRow as {
      ignored_senders?: string[] | null;
      ignored_domains?: string[] | null;
    } | null;

    const latestFrom = (messages?.at(-1) as { from_address?: string | null })
      ?.from_address;

    if (
      isAddressIgnored(latestFrom, {
        senders: normalizeIgnoredSenders(settings?.ignored_senders ?? []),
        domains: normalizeIgnoredDomains(settings?.ignored_domains ?? []),
      })
    ) {
      await stampExtractTip(admin, {
        threadId,
        userId,
        messageId: latestMessageId,
      });
      return { itemsInserted: 0, attempted: false };
    }
  }

  const threadText = buildThreadText(messages ?? []);
  if (threadText.trim().length < MIN_THREAD_TEXT_CHARS) {
    await stampExtractTip(admin, {
      threadId,
      userId,
      messageId: latestMessageId,
    });
    return { itemsInserted: 0, attempted: false };
  }

  const accountId =
    (thread as { account_id?: string | null }).account_id ||
    preferredAccountId ||
    null;
  const accountMembers = accountId
    ? await loadAccountMembersForExtraction(admin, accountId)
    : [];

  // Claim this tip before the model call. If the serverless function times out
  // mid-request, sync must not retry the same tip and silently burn credits.
  await stampExtractTip(admin, {
    threadId,
    userId,
    messageId: latestMessageId,
  });

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
        accountId: billingAccountId?.trim() || userId,
        supabase: admin,
      }),
    );
  } catch (error) {
    // Re-throw credit errors so the sync pipeline can stop early.
    // Tip stays stamped — retrying would not help until the user has credits
    // and a new message tip arrives.
    if (isInsufficientCreditsError(error)) {
      throw error;
    }
    return { itemsInserted: 0, attempted: true };
  }

  const filteredItems = items.filter((item) =>
    shouldIncludeExtractedItem(item, accountMembers, ownerEmail),
  );

  if (filteredItems.length === 0) {
    return { itemsInserted: 0, attempted: true };
  }

  const threadLink = linkFieldsFromThread(
    thread as {
      account_id?: string | null;
      client_id?: string | null;
      project_id?: string | null;
    },
  );

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

  return {
    itemsInserted: inserted?.length ?? 0,
    attempted: true,
  };
}

async function stampExtractTip(
  admin: SupabaseClient,
  input: { threadId: string; userId: string; messageId: string },
): Promise<void> {
  const { error } = await admin
    .from('email_threads')
    .update({
      assistant_extract_message_id: input.messageId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.threadId)
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}
