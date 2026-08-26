import 'server-only';

import { isSystemLabelId, listLabels, type GmailLabel } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { EmailThreadCategory } from './email-thread-categories';
import type { MailboxKind } from './mailbox-kind';
import {
  type SyncCategoryToGmailResult,
  syncCategoryToGmail,
} from './sync-category-to-gmail';

const OZER_LABEL_PREFIX = 'Ozer/';

export type AutoSyncGmailSettings = {
  sync_triage_to_gmail: boolean;
  respect_existing_gmail_labels: boolean;
};

export type AutoSyncCategoryToGmailResult =
  | (SyncCategoryToGmailResult & { skipped?: false })
  | {
      ok: true;
      skipped: true;
      reason: 'sync_disabled' | 'respect_existing_labels';
      labelIds: string[] | null;
    };

/**
 * Auto writeback after classify / reconcile. Manual triage should call
 * syncCategoryToGmail directly (always writes).
 */
export async function autoSyncCategoryToGmail(input: {
  userId: string;
  threadId: string;
  category: EmailThreadCategory;
  mailboxKind: MailboxKind;
  settings: AutoSyncGmailSettings;
  labelIds?: string[] | null;
}): Promise<AutoSyncCategoryToGmailResult> {
  if (!input.settings.sync_triage_to_gmail) {
    return {
      ok: true,
      skipped: true,
      reason: 'sync_disabled',
      labelIds: input.labelIds ?? null,
    };
  }

  let labelIds = input.labelIds;

  if (labelIds === undefined) {
    const admin = getSupabaseServerAdminClient();
    const { data: thread } = await admin
      .from('email_threads')
      .select('label_ids')
      .eq('id', input.threadId)
      .eq('user_id', input.userId)
      .maybeSingle();

    labelIds =
      (thread as { label_ids?: string[] | null } | null)?.label_ids ?? null;
  }

  if (input.settings.respect_existing_gmail_labels) {
    const labels = await listLabels(input.userId, input.mailboxKind);
    if (threadHasRespectedUserLabel(labelIds, labels)) {
      return {
        ok: true,
        skipped: true,
        reason: 'respect_existing_labels',
        labelIds,
      };
    }
  }

  const result = await syncCategoryToGmail({
    userId: input.userId,
    threadId: input.threadId,
    category: input.category,
  });

  return { ...result, skipped: false };
}

export function threadHasRespectedUserLabel(
  labelIds: string[] | null | undefined,
  labels: GmailLabel[],
): boolean {
  if (!labelIds?.length) {
    return false;
  }

  const byId = new Map(labels.map((label) => [label.id, label]));

  for (const id of labelIds) {
    if (isSystemLabelId(id)) {
      continue;
    }

    const label = byId.get(id);

    if (!label) {
      // Unknown non-system id — treat as a user label to be safe.
      return true;
    }

    if (label.type === 'user' && !label.name.startsWith(OZER_LABEL_PREFIX)) {
      return true;
    }
  }

  return false;
}
