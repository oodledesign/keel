import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveIgVoiceSettings } from './build-reply-prompt';
import { createPipelineLeadFromComment } from './create-pipeline-lead-from-comment';
import { generateIgReply } from './generate-reply';
import {
  isDmWindowExpiredError,
  postPrivateCommentReply,
  postPublicCommentReply,
} from './graph-api';
import {
  getEntryStepForTrigger,
  sendFlowStepToComment,
  triggerUsesInteractiveDm,
} from './dm-flow';
import { findMatchingTrigger } from './match-trigger';
import { decryptIgToken } from './token-crypto';
import {
  type IgConnectedAccountRow,
  type IgTriggerRow,
  parseIgVoiceSettings,
} from './types';

export type MetaCommentWebhookValue = {
  id?: string;
  text?: string;
  media?: { id?: string };
  from?: { id?: string; username?: string };
};

async function loadActiveTriggers(
  admin: SupabaseClient,
  igAccountId: string,
): Promise<IgTriggerRow[]> {
  const { data, error } = await admin
    .from('ig_triggers')
    .select('*')
    .eq('ig_account_id', igAccountId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as IgTriggerRow[];
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

  const triggers = await loadActiveTriggers(admin, params.igAccount.id);
  const matchedTrigger = findMatchingTrigger(triggers, commentText, mediaId);

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
      dm_status: matchedTrigger?.dm_enabled ? 'pending' : 'skipped',
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

  if (matchedTrigger.dm_enabled) {
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
