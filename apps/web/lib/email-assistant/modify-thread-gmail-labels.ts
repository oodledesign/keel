import 'server-only';

import {
  type GmailLabel,
  applyLabelIdChanges,
  isManualPickerLabel,
  listLabels,
  modifyThread,
} from '@kit/gmail';
import type { MailboxKind } from '@kit/google-auth';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type ModifyThreadGmailLabelsResult = {
  ok: boolean;
  labelIds: string[] | null;
  warning?: string;
};

export async function listMailboxGmailLabels(input: {
  userId: string;
  mailboxKind?: MailboxKind;
  accountId?: string | null;
}): Promise<GmailLabel[]> {
  const mailboxKind = input.mailboxKind ?? 'personal';
  const labels = await listLabels(input.userId, mailboxKind, {
    accountId: input.accountId,
  });

  return labels
    .filter(isManualPickerLabel)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllMailboxGmailLabels(input: {
  userId: string;
  mailboxKind?: MailboxKind;
  accountId?: string | null;
}): Promise<GmailLabel[]> {
  const mailboxKind = input.mailboxKind ?? 'personal';
  return listLabels(input.userId, mailboxKind, {
    accountId: input.accountId,
  });
}

/**
 * Manually add/remove Gmail user labels on a thread.
 * Ozer/* labels are filtered out — category UI owns those.
 */
export async function modifyThreadGmailLabels(input: {
  userId: string;
  threadId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}): Promise<ModifyThreadGmailLabelsResult> {
  const admin = getSupabaseServerAdminClient();

  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select('id, gmail_thread_id, connection_id, label_ids')
    .eq('id', input.threadId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (threadError) {
    return { ok: false, labelIds: null, warning: threadError.message };
  }

  if (!thread) {
    return { ok: false, labelIds: null, warning: 'Thread not found' };
  }

  const threadRow = thread as {
    gmail_thread_id: string;
    connection_id: string | null;
    label_ids: string[] | null;
  };

  if (!threadRow.gmail_thread_id) {
    return {
      ok: false,
      labelIds: threadRow.label_ids,
      warning: 'Thread has no Gmail id',
    };
  }

  const mailboxKind = await resolveMailboxKindForThread(
    input.userId,
    threadRow.connection_id,
  );

  try {
    const labels = await listLabels(input.userId, mailboxKind, {
      connectionId: threadRow.connection_id,
    });
    const allowedIds = new Set(
      labels.filter(isManualPickerLabel).map((label) => label.id),
    );

    const addLabelIds = (input.addLabelIds ?? []).filter((id) =>
      allowedIds.has(id),
    );
    const removeLabelIds = (input.removeLabelIds ?? []).filter((id) =>
      allowedIds.has(id),
    );

    if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
      return {
        ok: true,
        labelIds: threadRow.label_ids,
        warning: 'No applicable labels to change',
      };
    }

    await modifyThread(
      input.userId,
      threadRow.gmail_thread_id,
      { addLabelIds, removeLabelIds },
      mailboxKind,
      { connectionId: threadRow.connection_id },
    );

    const nextLabelIds = applyLabelIdChanges(
      threadRow.label_ids,
      addLabelIds,
      removeLabelIds,
    );

    const { error: updateError } = await admin
      .from('email_threads')
      .update({
        label_ids: nextLabelIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.threadId)
      .eq('user_id', input.userId);

    if (updateError) {
      return {
        ok: true,
        labelIds: nextLabelIds,
        warning: `Gmail updated but local label_ids failed: ${updateError.message}`,
      };
    }

    return { ok: true, labelIds: nextLabelIds };
  } catch (error) {
    return {
      ok: false,
      labelIds: threadRow.label_ids,
      warning:
        error instanceof Error
          ? error.message
          : 'Failed to update Gmail labels',
    };
  }
}

async function resolveMailboxKindForThread(
  userId: string,
  connectionId: string | null,
): Promise<MailboxKind> {
  const admin = getSupabaseServerAdminClient();

  if (connectionId) {
    const { data } = await admin
      .from('google_connections')
      .select('mailbox_kind')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .maybeSingle();

    const kind = (data as { mailbox_kind?: string | null } | null)
      ?.mailbox_kind;

    if (kind === 'personal') {
      return 'personal';
    }

    if (kind === 'business') {
      return 'business';
    }
  }

  // Missing or unknown connection — do not guess another workspace's mailbox.
  return 'business';
}
