import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';
import { isFromOwner } from '~/lib/email-assistant/address-utils';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import { ACTIONABLE_EMAIL_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';
import {
  type AutoSyncGmailSettings,
  autoSyncCategoryToGmail,
} from '~/lib/email-assistant/auto-sync-category-to-gmail';
import { categoryForOwnerLatestMessage } from '~/lib/email-assistant/owner-latest-message-category';
import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

/**
 * Clears actionable categories when the latest synced message is already from the mailbox owner
 * (e.g. they replied in Gmail outside Ozer). When sync_triage_to_gmail is enabled, mirrors the
 * new category to Gmail (archive Waiting/FYI/Noise) unless respect_existing_gmail_labels skips it.
 */
export async function reconcileRepliedNeedsReplyThreads(params: {
  userId?: string;
  accountId?: string;
  connectionId?: string;
  threadIds?: string[];
}): Promise<{ cleared: number }> {
  const admin = getSupabaseServerAdminClient();

  let query = admin
    .from('email_threads')
    .select('id, user_id, connection_id, label_ids')
    .in('assistant_category', [...ACTIONABLE_EMAIL_CATEGORIES]);

  if (params.threadIds && params.threadIds.length > 0) {
    query = query.in('id', params.threadIds);
  } else if (params.connectionId) {
    query = query.eq('connection_id', params.connectionId);
  } else if (params.accountId) {
    query = query.eq('account_id', params.accountId);
  } else if (params.userId) {
    query = query.eq('user_id', params.userId);
  } else {
    return { cleared: 0 };
  }

  const { data: threads, error } = await query.limit(50);

  if (error || !threads?.length) {
    return { cleared: 0 };
  }

  const ownerByUserId = new Map<string, string>();
  const settingsByConnectionId = new Map<string, AutoSyncGmailSettings>();
  const mailboxKindByConnectionId = new Map<string, MailboxKind>();
  let cleared = 0;

  for (const row of threads) {
    const threadId = row.id as string;
    const mailboxUserId = row.user_id as string;
    const connectionId = (row as { connection_id?: string | null }).connection_id ?? null;
    const labelIds = (row as { label_ids?: string[] | null }).label_ids ?? null;

    let ownerEmail = ownerByUserId.get(mailboxUserId);
    if (!ownerEmail) {
      const owner = await resolveDraftOwnerContext(mailboxUserId);
      if (!owner) {
        continue;
      }
      ownerEmail = owner.email;
      ownerByUserId.set(mailboxUserId, ownerEmail);
    }

    const { data: latest, error: latestError } = await admin
      .from('email_messages')
      .select('id, from_address, subject, snippet, body_text')
      .eq('thread_id', threadId)
      .eq('user_id', mailboxUserId)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestError || !latest) {
      continue;
    }

    if (!isFromOwner(latest.from_address as string | null, ownerEmail)) {
      continue;
    }

    const ownerCategory = categoryForOwnerLatestMessage({
      subject: latest.subject as string | null,
      snippet: latest.snippet as string | null,
      bodyText: latest.body_text as string | null,
    });

    const { error: updateError } = await admin
      .from('email_threads')
      .update({
        assistant_category: ownerCategory.category,
        assistant_category_reason: ownerCategory.reason,
        assistant_category_confidence: ownerCategory.confidence,
        assistant_processed_message_id: latest.id as string,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', mailboxUserId);

    if (updateError) {
      continue;
    }

    cleared += 1;
    queueEmailThreadBrainSync(threadId);

    if (!connectionId) {
      continue;
    }

    let syncSettings = settingsByConnectionId.get(connectionId);
    if (!syncSettings) {
      const { data: settingsRow } = await admin
        .from('email_assistant_settings')
        .select('sync_triage_to_gmail, respect_existing_gmail_labels')
        .eq('connection_id', connectionId)
        .maybeSingle();

      const typed = settingsRow as {
        sync_triage_to_gmail?: boolean | null;
        respect_existing_gmail_labels?: boolean | null;
      } | null;

      syncSettings = {
        sync_triage_to_gmail: typed?.sync_triage_to_gmail ?? false,
        respect_existing_gmail_labels:
          typed?.respect_existing_gmail_labels ?? true,
      };
      settingsByConnectionId.set(connectionId, syncSettings);
    }

    if (!syncSettings.sync_triage_to_gmail) {
      continue;
    }

    let mailboxKind = mailboxKindByConnectionId.get(connectionId);
    if (!mailboxKind) {
      const { data: connection } = await admin
        .from('google_connections')
        .select('mailbox_kind')
        .eq('id', connectionId)
        .eq('user_id', mailboxUserId)
        .maybeSingle();

      mailboxKind =
        (connection as { mailbox_kind?: string | null } | null)?.mailbox_kind ===
        'personal'
          ? 'personal'
          : 'business';
      mailboxKindByConnectionId.set(connectionId, mailboxKind);
    }

    try {
      await autoSyncCategoryToGmail({
        userId: mailboxUserId,
        threadId,
        category: ownerCategory.category,
        mailboxKind,
        settings: syncSettings,
        labelIds,
      });
    } catch {
      // DB category already updated; Gmail writeback is best-effort.
    }
  }

  return { cleared };
}
