import 'server-only';

import { classify } from '@kit/email-assistant';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isInsufficientCreditsError } from '~/lib/ai/router';
import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

import { isFromOwner } from './address-utils';
import { autoExtractEmailActionItems } from './auto-extract-email-action-items';
import { autoLinkEmailThread } from './auto-link-thread';
import { createThreadDraft } from './create-thread-draft';
import { resolveDraftOwnerContext } from './draft-owner';
import {
  type EmailThreadCategory,
  categoryFromTriageRuleAction,
  isActionableEmailCategory,
  shouldAutoDraftCategory,
  shouldAutoExtractCategory,
  shouldAutoLinkCategory,
} from './email-thread-categories';
import {
  type EmailTriageRules,
  matchEmailTriageRule,
  normalizeEmailTriageRules,
} from './email-triage-rules';
import type { MailboxKind } from './mailbox-kind';
import { createMeteredEmailGenerateText } from './metered-generate-text';
import { ensureNeedsReplyWorkspaceAffinity } from './needs-reply-workspace-affinity';
import { categoryForOwnerLatestMessage } from './owner-latest-message-category';
import { reconcileRepliedNeedsReplyThreads } from './reconcile-replied-threads';
import { resolveEmailAssistantBillingAccountId } from './resolve-email-assistant-billing-account';
import { suggestPipelineLeadForThread } from './suggest-pipeline-lead';
import { buildThreadText } from './thread-text';

async function maybeSuggestPipelineLead(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  params: {
    userId: string;
    threadId: string;
    mailboxKind: MailboxKind;
    preferredAccountId: string | null;
    billingAccountId: string | null;
  },
  errors: string[],
) {
  if (params.mailboxKind === 'personal') {
    return;
  }

  try {
    await suggestPipelineLeadForThread(admin, {
      userId: params.userId,
      threadId: params.threadId,
      preferredAccountId: params.preferredAccountId,
      billingAccountId: params.billingAccountId,
      mailboxKind: params.mailboxKind,
    });
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : 'Pipeline lead suggestion failed',
    );
  }
}

const MAX_CLASSIFY_PER_RUN = 40;
const MAX_AUTO_DRAFT_PER_RUN = 3;
const MAX_AUTO_EXTRACT_PER_RUN = 5;

export type EmailAssistantPipelineResult = {
  classified: number;
  linked: number;
  draftsCreated: number;
  draftsSavedToGmail: number;
  extracted: number;
  skipped: number;
  errors: string[];
};

type ThreadRow = {
  id: string;
  subject: string | null;
  assistant_category: EmailThreadCategory | null;
  assistant_processed_message_id: string | null;
  assistant_extract_message_id: string | null;
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
  triageRules: EmailTriageRules;
};

export async function runEmailAssistantPipeline(
  userId: string,
  options?: {
    mailboxKind?: MailboxKind;
    preferredAccountId?: string | null;
  },
): Promise<EmailAssistantPipelineResult> {
  const mailboxKind = options?.mailboxKind ?? 'business';
  const preferredAccountId = options?.preferredAccountId ?? null;
  const skipAutoLink = mailboxKind === 'personal';

  const result: EmailAssistantPipelineResult = {
    classified: 0,
    linked: 0,
    draftsCreated: 0,
    draftsSavedToGmail: 0,
    extracted: 0,
    skipped: 0,
    errors: [],
  };

  const admin = getSupabaseServerAdminClient();
  const owner = await resolveDraftOwnerContext(userId, mailboxKind);

  if (!owner?.connectionId) {
    result.errors.push('Could not resolve mailbox owner');
    return result;
  }

  const { data: settingsRow, error: settingsError } = await admin
    .from('email_assistant_settings')
    .select(
      'auto_triage_enabled, auto_draft_enabled, auto_save_gmail_drafts, ignored_senders, ignored_domains, ignored_subject_keywords, priority_senders, priority_domains, priority_subject_keywords',
    )
    .eq('connection_id', owner.connectionId)
    .maybeSingle();

  if (settingsError) {
    result.errors.push(settingsError.message);
    return result;
  }

  const settingsRowTyped = settingsRow as {
    auto_triage_enabled?: boolean | null;
    auto_draft_enabled?: boolean | null;
    auto_save_gmail_drafts?: boolean | null;
    ignored_senders?: string[] | null;
    ignored_domains?: string[] | null;
    ignored_subject_keywords?: string[] | null;
    priority_senders?: string[] | null;
    priority_domains?: string[] | null;
    priority_subject_keywords?: string[] | null;
  } | null;

  const settings: AssistantSettings = {
    auto_triage_enabled: settingsRowTyped?.auto_triage_enabled ?? true,
    auto_draft_enabled: settingsRowTyped?.auto_draft_enabled ?? true,
    auto_save_gmail_drafts: settingsRowTyped?.auto_save_gmail_drafts ?? false,
    triageRules: normalizeEmailTriageRules(settingsRowTyped),
  };

  if (!settings.auto_triage_enabled && !settings.auto_draft_enabled) {
    return result;
  }

  const billingAccountId = await resolveEmailAssistantBillingAccountId(admin, {
    userId,
    mailboxKind,
    preferredAccountId,
  });

  try {
    await reconcileRepliedNeedsReplyThreads({
      userId,
      connectionId: owner.connectionId,
    });
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? error.message
        : 'Failed to reconcile replied threads',
    );
  }

  const { data: threadRows, error: threadsError } = await admin
    .from('email_threads')
    .select(
      'id, subject, assistant_category, assistant_processed_message_id, assistant_extract_message_id, link_source',
    )
    .eq('user_id', userId)
    .eq('connection_id', owner.connectionId)
    .order('assistant_category', { ascending: true, nullsFirst: true })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (threadsError) {
    result.errors.push(threadsError.message);
    return result;
  }

  let draftsRemaining = settings.auto_draft_enabled
    ? MAX_AUTO_DRAFT_PER_RUN
    : 0;
  let extractsRemaining = MAX_AUTO_EXTRACT_PER_RUN;

  for (const thread of (threadRows ?? []) as unknown as ThreadRow[]) {
    if (
      result.classified >= MAX_CLASSIFY_PER_RUN &&
      draftsRemaining <= 0 &&
      extractsRemaining <= 0
    ) {
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

    const ruleMatch = matchEmailTriageRule(
      {
        fromAddress: latest.from_address,
        subject: latest.subject ?? thread.subject,
      },
      settings.triageRules,
    );

    if (ruleMatch) {
      const category = categoryFromTriageRuleAction(ruleMatch.action);
      const { error: ruleUpdateError } = await admin
        .from('email_threads')
        .update({
          assistant_category: category,
          assistant_category_reason: ruleMatch.reason,
          assistant_category_confidence: 1,
          assistant_processed_message_id: latest.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', thread.id)
        .eq('user_id', userId);

      if (ruleUpdateError) {
        result.errors.push(ruleUpdateError.message);
      } else {
        result.classified += 1;
      }

      result.skipped += 1;
      continue;
    }

    if (thread.assistant_processed_message_id === latest.id) {
      if (thread.assistant_category === 'waiting') {
        const ownerCategory = categoryForOwnerLatestMessage({
          subject: latest.subject ?? thread.subject,
          snippet: latest.snippet,
          bodyText: latest.body_text,
        });

        if (ownerCategory.category !== 'waiting') {
          const { error: fixCategoryError } = await admin
            .from('email_threads')
            .update({
              assistant_category: ownerCategory.category,
              assistant_category_reason: ownerCategory.reason,
              assistant_category_confidence: ownerCategory.confidence,
              updated_at: new Date().toISOString(),
            })
            .eq('id', thread.id)
            .eq('user_id', userId);

          if (fixCategoryError) {
            result.errors.push(fixCategoryError.message);
          }
        }
      }

      // Already handled this message tip — do not reclassify every sync.
      // Backfill extract only when this tip has never been extracted.
      if (
        isActionableEmailCategory(thread.assistant_category) &&
        thread.assistant_extract_message_id !== latest.id &&
        extractsRemaining > 0
      ) {
        try {
          const extractResult = await autoExtractEmailActionItems({
            admin,
            userId,
            threadId: thread.id,
            ownerEmail: owner.email,
            ownerDisplayName: owner.displayName,
            preferredAccountId,
            billingAccountId,
          });
          if (extractResult.itemsInserted > 0) {
            result.extracted += extractResult.itemsInserted;
          }
          if (extractResult.attempted) {
            extractsRemaining -= 1;
          } else {
            result.skipped += 1;
          }
        } catch (error) {
          result.errors.push(
            error instanceof Error ? error.message : 'Auto-extract failed',
          );
          if (isInsufficientCreditsError(error)) {
            break;
          }
        }
      } else {
        result.skipped += 1;
      }
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
        isActionableEmailCategory(thread.assistant_category) &&
        settings.auto_draft_enabled &&
        shouldAutoDraftCategory(thread.assistant_category) &&
        draftsRemaining > 0
      ) {
        try {
          const draftResult = await createThreadDraft({
            userId,
            threadId: thread.id,
            saveToGmail: settings.auto_save_gmail_drafts,
            billingAccountId,
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
          if (isInsufficientCreditsError(error)) {
            break;
          }
        }
      } else {
        result.skipped += 1;
      }

      if (
        !skipAutoLink &&
        shouldAutoLinkCategory(thread.assistant_category) &&
        (!thread.link_source || thread.link_source === 'auto')
      ) {
        try {
          const linked = await autoLinkEmailThread(
            admin,
            userId,
            thread.id,
            owner.email,
            { preferredAccountId },
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

      await maybeSuggestPipelineLead(
        admin,
        {
          userId,
          threadId: thread.id,
          mailboxKind,
          preferredAccountId,
          billingAccountId,
        },
        result.errors,
      );

      // Workspace email page passes preferredAccountId (e.g. Oodle) — stamp it
      // when auto-link did not find a client/project.
      try {
        await ensureNeedsReplyWorkspaceAffinity(admin, {
          userId,
          threadId: thread.id,
          preferredAccountId,
        });
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Workspace affinity failed',
        );
      }

      queueEmailThreadBrainSync(thread.id, preferredAccountId);

      continue;
    }

    if (result.classified >= MAX_CLASSIFY_PER_RUN) {
      continue;
    }

    let category: EmailThreadCategory | null = 'noise';
    let reason: string | null = null;
    let confidence: number | null = null;

    if (isFromOwner(latest.from_address, owner.email)) {
      const ownerCategory = categoryForOwnerLatestMessage({
        subject: latest.subject ?? thread.subject,
        snippet: latest.snippet,
        bodyText: latest.body_text,
      });
      category = ownerCategory.category;
      reason = ownerCategory.reason;
      confidence = ownerCategory.confidence;
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
        const classified = await classify(
          threadText,
          owner,
          createMeteredEmailGenerateText({
            feature: 'email_triage',
            accountId: billingAccountId,
            supabase: admin,
          }),
        );
        category = classified.category;
        reason = classified.reason;
        confidence = classified.confidence;
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Classification failed',
        );
        if (isInsufficientCreditsError(error)) {
          break;
        }
        continue;
      }
    }

    const { error: updateThreadError } = await admin
      .from('email_threads')
      .update({
        assistant_category: category,
        assistant_category_reason: reason,
        assistant_category_confidence: confidence,
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

    if (
      !skipAutoLink &&
      shouldAutoLinkCategory(category) &&
      (!thread.link_source || thread.link_source === 'auto')
    ) {
      try {
        const linked = await autoLinkEmailThread(
          admin,
          userId,
          thread.id,
          owner.email,
          { preferredAccountId },
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

    await maybeSuggestPipelineLead(
      admin,
      {
        userId,
        threadId: thread.id,
        mailboxKind,
        preferredAccountId,
        billingAccountId,
      },
      result.errors,
    );

    try {
      await ensureNeedsReplyWorkspaceAffinity(admin, {
        userId,
        threadId: thread.id,
        preferredAccountId,
      });
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : 'Workspace affinity failed',
      );
    }

    queueEmailThreadBrainSync(thread.id, preferredAccountId);

    if (
      shouldAutoDraftCategory(category) &&
      draftsRemaining > 0 &&
      settings.auto_draft_enabled
    ) {
      try {
        const draftResult = await createThreadDraft({
          userId,
          threadId: thread.id,
          saveToGmail: settings.auto_save_gmail_drafts,
          billingAccountId,
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
        if (isInsufficientCreditsError(error)) {
          break;
        }
      }
    }

    if (
      shouldAutoExtractCategory(category) &&
      extractsRemaining > 0 &&
      thread.assistant_extract_message_id !== latest.id
    ) {
      try {
        const extractResult = await autoExtractEmailActionItems({
          admin,
          userId,
          threadId: thread.id,
          ownerEmail: owner.email,
          ownerDisplayName: owner.displayName,
          preferredAccountId,
          billingAccountId,
        });
        if (extractResult.itemsInserted > 0) {
          result.extracted += extractResult.itemsInserted;
        }
        if (extractResult.attempted) {
          extractsRemaining -= 1;
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Auto-extract failed',
        );
        if (isInsufficientCreditsError(error)) {
          break;
        }
      }
    }
  }

  return result;
}
