import 'server-only';

import {
  applyLabelIdChanges,
  ensureLabel,
  listLabels,
  modifyThread,
} from '@kit/gmail';
import type { MailboxKind } from '@kit/google-auth';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { EmailThreadCategory } from './email-thread-categories';
import { EMAIL_THREAD_CATEGORY_LABELS } from './email-thread-categories';

const OZER_LABEL_PREFIX = 'Ozer/';

const CATEGORY_GMAIL_LABEL: Record<EmailThreadCategory, string> = {
  reply_now: `${OZER_LABEL_PREFIX}Reply now`,
  reply_later: `${OZER_LABEL_PREFIX}Reply later`,
  waiting: `${OZER_LABEL_PREFIX}Waiting`,
  fyi: `${OZER_LABEL_PREFIX}FYI`,
  noise: `${OZER_LABEL_PREFIX}Noise`,
};

/** Categories that should leave the Gmail inbox (archive). */
const ARCHIVE_CATEGORIES = new Set<EmailThreadCategory>([
  'waiting',
  'fyi',
  'noise',
]);

export function ozerGmailLabelName(category: EmailThreadCategory): string {
  return CATEGORY_GMAIL_LABEL[category];
}

export function shouldArchiveCategory(category: EmailThreadCategory): boolean {
  return ARCHIVE_CATEGORIES.has(category);
}

export type SyncCategoryToGmailResult = {
  ok: boolean;
  labelIds: string[] | null;
  warning?: string;
};

/**
 * Mirror a manual Ozer triage category onto Gmail:
 * - ensure one Ozer/{Category} label (remove other Ozer/*)
 * - archive (remove INBOX) for waiting/fyi/noise
 * - re-add INBOX for reply_now / reply_later
 */
export async function syncCategoryToGmail(input: {
  userId: string;
  threadId: string;
  category: EmailThreadCategory;
}): Promise<SyncCategoryToGmailResult> {
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
    const targetName = ozerGmailLabelName(input.category);
    const targetLabel = await ensureLabel(
      input.userId,
      targetName,
      mailboxKind,
    );
    const allLabels = await listLabels(input.userId, mailboxKind);
    const otherOzerLabelIds = allLabels
      .filter(
        (label) =>
          label.name.startsWith(OZER_LABEL_PREFIX) &&
          label.id !== targetLabel.id,
      )
      .map((label) => label.id);

    const addLabelIds = [targetLabel.id];
    const removeLabelIds = [...otherOzerLabelIds];

    if (shouldArchiveCategory(input.category)) {
      removeLabelIds.push('INBOX');
    } else {
      addLabelIds.push('INBOX');
    }

    await modifyThread(
      input.userId,
      threadRow.gmail_thread_id,
      { addLabelIds, removeLabelIds },
      mailboxKind,
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
    const message =
      error instanceof Error
        ? error.message
        : `Failed to sync ${EMAIL_THREAD_CATEGORY_LABELS[input.category]} to Gmail`;

    return {
      ok: false,
      labelIds: threadRow.label_ids,
      warning: message,
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

  const { data: connections } = await admin
    .from('google_connections')
    .select('mailbox_kind')
    .eq('user_id', userId);

  const rows = (connections ?? []) as Array<{ mailbox_kind?: string | null }>;
  const preferred =
    rows.find((row) => row.mailbox_kind === 'business') ?? rows[0];

  return preferred?.mailbox_kind === 'personal' ? 'personal' : 'business';
}
