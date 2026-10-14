import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveIgVoiceSettings } from './build-reply-prompt';
import { createPipelineLeadFromComment } from './create-pipeline-lead-from-comment';
import {
  getEntryStepForTrigger,
  sendFlowStepToComment,
  triggerUsesInteractiveDm,
} from './dm-flow';
import { generateIgReply } from './generate-reply';
import {
  isDmWindowExpiredError,
  postPrivateCommentReply,
  postPublicCommentReply,
} from './graph-api';
import {
  type IgInboundTriggerEvent,
  findMatchingTrigger,
  findMatchingV2Triggers,
} from './match-trigger';
import { upsertIgContact } from './sequence/contacts';
import { startMatchingAutomation } from './sequence/inbound';
import { recordInboundEvent } from './sequence/message-events';
import { decryptIgToken } from './token-crypto';
import {
  type IgConnectedAccountRow,
  type IgTriggerFullRow,
  parseIgVoiceSettings,
} from './types';

export type MetaCommentWebhookValue = {
  id?: string;
  text?: string;
  media?: { id?: string; media_product_type?: string };
  from?: { id?: string; username?: string };
};

type TriggerWithSteps = IgTriggerFullRow & {
  ig_automation_steps?: Array<{ count: number }>;
};

async function loadActiveTriggers(
  admin: SupabaseClient,
  igAccountId: string,
): Promise<{ sequence: IgTriggerFullRow[]; legacy: IgTriggerFullRow[] }> {
  const { data, error } = await admin
    .from('ig_triggers')
    .select('*, ig_automation_steps(count)')
    .eq('ig_account_id', igAccountId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const sequence: IgTriggerFullRow[] = [];
  const legacy: IgTriggerFullRow[] = [];
  for (const row of (data ?? []) as TriggerWithSteps[]) {
    const { ig_automation_steps: steps, ...trigger } = row;
    if ((steps?.[0]?.count ?? 0) > 0) {
      sequence.push(trigger as IgTriggerFullRow);
    } else if (
      (trigger.trigger_type ?? 'comment_keyword') === 'comment_keyword'
    ) {
      legacy.push(trigger as IgTriggerFullRow);
    }
  }
  return { sequence, legacy };
}

export async function processInstagramCommentEvent(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    comment: MetaCommentWebhookValue;
  },
): Promise<void> {
  const commentId = params.comment.id?.trim();
  if (!commentId) return;

  const commentText = params.comment.text?.trim() ?? '';
  const mediaId = params.comment.media?.id?.trim() ?? null;
  const commenterUsername = params.comment.from?.username?.trim() ?? null;
  const commenterIgId = params.comment.from?.id?.trim() ?? null;

  // Our own replies also arrive as comment webhooks; never react to them.
  if (
    commenterIgId &&
    commenterIgId === params.igAccount.ig_business_account_id
  ) {
    return;
  }

  const triggers = await loadActiveTriggers(admin, params.igAccount.id);
  const commentEvent: IgInboundTriggerEvent = {
    kind: 'comment',
    text: commentText,
    mediaId,
    mediaProductType: params.comment.media?.media_product_type ?? null,
  };
  const sequenceMatches = findMatchingV2Triggers(
    triggers.sequence,
    commentEvent,
  );
  const matchedTrigger =
    sequenceMatches[0] ??
    findMatchingTrigger(triggers.legacy, commentText, mediaId);
  const usesSequence = sequenceMatches.length > 0;

  const { data: inserted, error: insertError } = await admin
    .from('ig_comment_events')
    .insert({
      ig_account_id: params.igAccount.id,
      account_id: params.igAccount.account_id,
      comment_id: commentId,
      media_id: mediaId,
      commenter_username: commenterUsername,
      commenter_ig_id: commenterIgId,
      comment_text: commentText,
      matched_trigger_id: matchedTrigger?.id ?? null,
      public_reply_status: matchedTrigger?.public_reply_enabled
        ? 'pending'
        : 'skipped',
      dm_status:
        usesSequence || matchedTrigger?.dm_enabled ? 'pending' : 'skipped',
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return;
    }
    throw new Error(insertError.message);
  }

  const eventId = (inserted as { id: string }).id;

  if (!matchedTrigger) {
    await admin
      .from('ig_comment_events')
      .update({
        public_reply_status: 'skipped',
        dm_status: 'skipped',
        error_message: 'No matching trigger',
      })
      .eq('id', eventId);
    return;
  }

  if (!params.igAccount.is_active) {
    await admin
      .from('ig_comment_events')
      .update({
        public_reply_status: 'skipped',
        dm_status: 'skipped',
        error_message: 'Instagram account disconnected',
      })
      .eq('id', eventId);
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptIgToken(params.igAccount.access_token);
  } catch {
    await admin
      .from('ig_comment_events')
      .update({
        public_reply_status: 'failed',
        dm_status: 'failed',
        error_message: 'Could not decrypt access token',
      })
      .eq('id', eventId);
    return;
  }

  const accountVoice = parseIgVoiceSettings(params.igAccount.voice_settings);
  const voiceSettings = resolveIgVoiceSettings(
    accountVoice,
    matchedTrigger.voice_settings_override,
  );

  const errors: string[] = [];
  let pipelineDealId: string | null = null;

  if (matchedTrigger.public_reply_enabled) {
    const reply = await generateIgReply({
      client: admin,
      accountId: params.igAccount.account_id,
      voiceSettings,
      commentText,
      commenterUsername,
      channel: 'public_comment',
      mode: matchedTrigger.public_reply_mode,
      aiTier: matchedTrigger.public_reply_ai_tier,
      staticTemplate: matchedTrigger.public_reply_template,
    });

    if (!reply.ok) {
      errors.push(`Public reply: ${reply.message}`);
      await admin
        .from('ig_comment_events')
        .update({
          public_reply_status:
            reply.reason === 'skipped' ? 'skipped' : 'failed',
          error_message: reply.message,
        })
        .eq('id', eventId);
    } else {
      try {
        await postPublicCommentReply(commentId, reply.text, accessToken);
        await admin
          .from('ig_comment_events')
          .update({
            public_reply_status: 'sent',
            public_reply_sent_at: new Date().toISOString(),
            public_reply_content: reply.text,
            public_reply_ai_credits_spent: reply.creditsSpent || null,
          })
          .eq('id', eventId);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Public reply failed';
        errors.push(`Public reply: ${msg}`);
        await admin
          .from('ig_comment_events')
          .update({
            public_reply_status: 'failed',
            public_reply_content: reply.text,
            public_reply_ai_credits_spent: reply.creditsSpent || null,
            error_message: msg,
          })
          .eq('id', eventId);
      }
    }
  }

  if (usesSequence) {
    const dmError = await startSequenceForComment(admin, {
      igAccount: params.igAccount,
      triggers: sequenceMatches,
      commentEvent,
      commentId,
      commentText,
      commenterIgId,
      commenterUsername,
      eventId,
    });
    if (dmError) errors.push(`DM: ${dmError}`);
  } else if (matchedTrigger.dm_enabled) {
    if (triggerUsesInteractiveDm(matchedTrigger)) {
      const entryStep = getEntryStepForTrigger(matchedTrigger);
      if (!entryStep) {
        errors.push('DM: Invalid interactive flow configuration');
        await admin
          .from('ig_comment_events')
          .update({ dm_status: 'failed', error_message: 'Invalid DM flow' })
          .eq('id', eventId);
      } else if (!commenterIgId) {
        errors.push('DM: Missing commenter Instagram ID for interactive flow');
        await admin
          .from('ig_comment_events')
          .update({
            dm_status: 'failed',
            error_message: 'Missing commenter ID',
          })
          .eq('id', eventId);
      } else {
        try {
          await sendFlowStepToComment({
            igBusinessAccountId: params.igAccount.ig_business_account_id,
            commentId,
            accessToken,
            triggerId: matchedTrigger.id,
            step: entryStep,
          });

          await admin.from('ig_dm_sessions').insert({
            ig_account_id: params.igAccount.id,
            account_id: params.igAccount.account_id,
            trigger_id: matchedTrigger.id,
            comment_event_id: eventId,
            commenter_ig_id: commenterIgId,
            current_step_id: entryStep.id,
            status: 'active',
          });

          await admin
            .from('ig_comment_events')
            .update({
              dm_status: 'sent',
              dm_sent_at: new Date().toISOString(),
              dm_content: entryStep.message,
            })
            .eq('id', eventId);
        } catch (error) {
          const windowExpired = isDmWindowExpiredError(error);
          const msg =
            error instanceof Error ? error.message : 'Interactive DM failed';
          errors.push(`DM: ${msg}`);
          await admin
            .from('ig_comment_events')
            .update({
              dm_status: windowExpired ? 'window_expired' : 'failed',
              error_message: msg,
            })
            .eq('id', eventId);
        }
      }
    } else {
      const reply = await generateIgReply({
        client: admin,
        accountId: params.igAccount.account_id,
        voiceSettings,
        commentText,
        commenterUsername,
        channel: 'dm',
        mode: matchedTrigger.dm_mode,
        aiTier: matchedTrigger.dm_ai_tier,
        staticTemplate: matchedTrigger.dm_template,
      });

      if (!reply.ok) {
        errors.push(`DM: ${reply.message}`);
        await admin
          .from('ig_comment_events')
          .update({
            dm_status: reply.reason === 'skipped' ? 'skipped' : 'failed',
          })
          .eq('id', eventId);
      } else {
        try {
          await postPrivateCommentReply(
            params.igAccount.ig_business_account_id,
            commentId,
            reply.text,
            accessToken,
          );
          await admin
            .from('ig_comment_events')
            .update({
              dm_status: 'sent',
              dm_sent_at: new Date().toISOString(),
              dm_content: reply.text,
              dm_ai_credits_spent: reply.creditsSpent || null,
            })
            .eq('id', eventId);
        } catch (error) {
          const windowExpired = isDmWindowExpiredError(error);
          const msg = error instanceof Error ? error.message : 'DM failed';
          errors.push(`DM: ${msg}`);
          await admin
            .from('ig_comment_events')
            .update({
              dm_status: windowExpired ? 'window_expired' : 'failed',
              dm_content: reply.text,
              dm_ai_credits_spent: reply.creditsSpent || null,
            })
            .eq('id', eventId);
        }
      }
    }
  }

  if (matchedTrigger.create_deal_on_match) {
    try {
      const lead = await createPipelineLeadFromComment(admin, {
        accountId: params.igAccount.account_id,
        commenterUsername,
        commentText,
        stage: matchedTrigger.deal_stage ?? 'lead',
      });
      pipelineDealId = lead.dealId;
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Pipeline lead creation failed';
      errors.push(`Pipeline: ${msg}`);
    }
  }

  if (pipelineDealId || errors.length > 0) {
    await admin
      .from('ig_comment_events')
      .update({
        pipeline_deal_id: pipelineDealId,
        ...(errors.length > 0 ? { error_message: errors.join(' | ') } : {}),
      })
      .eq('id', eventId);
  }
}

/**
 * Start a v2 automation for a matched comment and mirror the outcome onto the
 * comment event row. Returns an error message for the activity log, if any.
 */
async function startSequenceForComment(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    triggers: IgTriggerFullRow[];
    commentEvent: IgInboundTriggerEvent;
    commentId: string;
    commentText: string;
    commenterIgId: string | null;
    commenterUsername: string | null;
    eventId: string;
  },
): Promise<string | null> {
  const markDm = (patch: Record<string, unknown>) =>
    admin.from('ig_comment_events').update(patch).eq('id', params.eventId);

  if (!params.commenterIgId) {
    await markDm({
      dm_status: 'failed',
      error_message: 'Missing commenter ID',
    });
    return 'Missing commenter Instagram ID';
  }

  const contact = await upsertIgContact(admin, {
    igAccount: params.igAccount,
    igsid: params.commenterIgId,
    username: params.commenterUsername,
  });

  await recordInboundEvent(
    admin,
    {
      accountId: params.igAccount.account_id,
      igAccountId: params.igAccount.id,
      contactId: contact.id,
    },
    {
      idempotencyKey: `in:comment:${params.commentId}`,
      eventType: 'comment',
      body: params.commentText,
    },
  );

  if (contact.opted_out_at) {
    await markDm({ dm_status: 'skipped', error_message: 'Contact opted out' });
    return null;
  }

  const started = await startMatchingAutomation(admin, {
    igAccount: params.igAccount,
    contact,
    event: params.commentEvent,
    source: 'comment',
    sourceEventId: params.commentId,
    sourceCommentId: params.commentId,
    triggers: params.triggers,
  });

  if (!started) {
    await markDm({
      dm_status: 'skipped',
      error_message:
        'Already messaged this person (once per person or cooldown)',
    });
    return null;
  }
  if (!started.runId) return null;

  const [{ data: run }, { data: firstSend }] = await Promise.all([
    admin
      .from('ig_automation_runs')
      .select('status, last_error')
      .eq('id', started.runId)
      .maybeSingle(),
    admin
      .from('ig_message_events')
      .select('body')
      .eq('run_id', started.runId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const status = (run as { status: string } | null)?.status;
  const lastError = (run as { last_error: string | null } | null)?.last_error;
  const dmContent = (firstSend as { body: string | null } | null)?.body ?? null;

  if (status === 'failed' || status === 'window_expired') {
    await markDm({
      dm_status: status === 'failed' ? 'failed' : 'window_expired',
      dm_content: dmContent,
      matched_trigger_id: started.triggerId,
    });
    return lastError ?? 'Automation failed';
  }

  await markDm({
    dm_status: 'sent',
    dm_sent_at: new Date().toISOString(),
    dm_content: dmContent,
    matched_trigger_id: started.triggerId,
  });
  return null;
}
