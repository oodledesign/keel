import 'server-only';

import { classify } from '@kit/email-assistant';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isFromOwner } from './address-utils';
import { autoLinkEmailThread } from './auto-link-thread';
import { createThreadDraft } from './create-thread-draft';
import { resolveDraftOwnerContext } from './draft-owner';
import { buildThreadText } from './thread-text';

const MAX_CLASSIFY_PER_RUN = 8;
const MAX_AUTO_DRAFT_PER_RUN = 3;

export type EmailAssistantPipelineResult = {
  classified: number;
  linked: number;
  draftsCreated: number;
  draftsSavedToGmail: number;
  skipped: number;
  errors: string[];
};

type ThreadRow = {
  id: string;
  subject: string | null;
  assistant_category: 'needs_reply' | 'no_reply' | null;
  assistant_processed_message_id: string | null;
  link_source: string | null;
};

type MessageRow = {
  id: string;
  from_address: string | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  internal_date: string | null;
  created_at: string;
};

type AssistantSettings = {
  auto_triage_enabled: boolean;
  auto_draft_enabled: boolean;
  auto_save_gmail_drafts: boolean;
};

export async function runEmailAssistantPipeline(
  userId: string,
): Promise<EmailAssistantPipelineResult> {
  const result: EmailAssistantPipelineResult = {
    classified: 0,
    linked: 0,
    draftsCreated: 0,
    draftsSavedToGmail: 0,
    skipped: 0,
    errors: [],
  };

  const admin = getSupabaseServerAdminClient();

  const { data: settingsRow, error: settingsError } = await admin
    .from('email_assistant_settings')
    .select('auto_triage_enabled, auto_draft_enabled, auto_save_gmail_drafts')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    result.errors.push(settingsError.message);
    return result;
  }

  const settings = (settingsRow as AssistantSettings | null) ?? {
    auto_triage_enabled: true,
    auto_draft_enabled: true,
    auto_save_gmail_drafts: false,
  };

  if (!settings.auto_triage_enabled && !settings.auto_draft_enabled) {
    return result;
  }

  const owner = await resolveDraftOwnerContext(userId);

  if (!owner) {
    result.errors.push('Could not resolve mailbox owner');
    return result;
  }

  const { data: threadRows, error: threadsError } = await admin
    .from('email_threads')
    .select(
      'id, subject, assistant_category, assistant_processed_message_id, link_source',
    )
    .eq('user_id', userId)
    .order('assistant_category', { ascending: true, nullsFirst: true })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(30);

  if (threadsError) {
    result.errors.push(threadsError.message);
    return result;
  }

  let draftsRemaining = settings.auto_draft_enabled
    ? MAX_AUTO_DRAFT_PER_RUN
    : 0;

  for (const thread of (threadRows ?? []) as ThreadRow[]) {
    if (result.classified >= MAX_CLASSIFY_PER_RUN && draftsRemaining <= 0) {
      break;
    }

    const { data: latestMessage, error: latestError } = await admin
      .from('email_messages')
      .select(
        'id, from_address, subject, body_text, snippet, internal_date, created_at',
      )
      .eq('thread_id', thread.id)
      .eq('user_id', userId)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      result.errors.push(latestError.message);
      continue;
    }

    if (!latestMessage) {
      result.skipped += 1;
      continue;
    }

    const latest = latestMessage as MessageRow;

    if (
      thread.assistant_processed_message_id === latest.id &&
      (!settings.auto_triage_enabled || thread.assistant_category !== null)
    ) {
      continue;
    }

    if (!settings.auto_triage_enabled) {
      const { error: markProcessedError } = await admin
        .from('email_threads')
        .update({
          assistant_processed_message_id: latest.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', thread.id)
        .eq('user_id', userId);

      if (markProcessedError) {
        result.errors.push(markProcessedError.message);
      }

      if (
        thread.assistant_category === 'needs_reply' &&
        settings.auto_draft_enabled &&
        draftsRemaining > 0
      ) {
        try {
          const draftResult = await createThreadDraft({
            userId,
            threadId: thread.id,
            saveToGmail: settings.auto_save_gmail_drafts,
          });

          if (draftResult) {
            result.draftsCreated += 1;
            draftsRemaining -= 1;

            if (draftResult.gmailDraftId) {
              result.draftsSavedToGmail += 1;
            }
          }
        } catch (error) {
          result.errors.push(
            error instanceof Error ? error.message : 'Auto-draft failed',
          );
        }
      } else {
        result.skipped += 1;
      }

      if (!thread.link_source || thread.link_source === 'auto') {
        try {
          const linked = await autoLinkEmailThread(
            admin,
            userId,
            thread.id,
            owner.email,
          );

          if (linked) {
            result.linked += 1;
          }
        } catch (error) {
          result.errors.push(
            error instanceof Error ? error.message : 'Auto-link failed',
          );
        }
      }

      continue;
    }

    if (result.classified >= MAX_CLASSIFY_PER_RUN) {
      continue;
    }

    let category: 'needs_reply' | 'no_reply' = 'no_reply';
    let reason: string | null = null;

    if (isFromOwner(latest.from_address, owner.email)) {
      category = 'no_reply';
      reason = 'Latest message is from you';
    } else {
      const { data: messages, error: messagesError } = await admin
        .from('email_messages')
        .select(
          'id, from_address, subject, body_text, snippet, internal_date, created_at',
        )
        .eq('thread_id', thread.id)
        .eq('user_id', userId)
        .order('internal_date', { ascending: true, nullsFirst: false });

      if (messagesError) {
        result.errors.push(messagesError.message);
        continue;
      }

      const threadText = buildThreadText((messages ?? []) as MessageRow[]);

      try {
        const classified = await classify(threadText, owner);
        category = classified.category;
        reason = classified.reason;
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Classification failed',
        );
        continue;
      }
    }

    const { error: updateThreadError } = await admin
      .from('email_threads')
      .update({
        assistant_category: category,
        assistant_category_reason: reason,
        assistant_processed_message_id: latest.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', thread.id)
      .eq('user_id', userId);

    if (updateThreadError) {
      result.errors.push(updateThreadError.message);
      continue;
    }

    result.classified += 1;

    if (!thread.link_source || thread.link_source === 'auto') {
      try {
        const linked = await autoLinkEmailThread(
          admin,
          userId,
          thread.id,
          owner.email,
        );

        if (linked) {
          result.linked += 1;
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Auto-link failed',
        );
      }
    }

    if (
      category === 'needs_reply' &&
      draftsRemaining > 0 &&
      settings.auto_draft_enabled
    ) {
      try {
        const draftResult = await createThreadDraft({
          userId,
          threadId: thread.id,
          saveToGmail: settings.auto_save_gmail_drafts,
        });

        if (draftResult) {
          result.draftsCreated += 1;
          draftsRemaining -= 1;

          if (draftResult.gmailDraftId) {
            result.draftsSavedToGmail += 1;
          }
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Auto-draft failed',
        );
      }
    }
  }

  return result;
}
