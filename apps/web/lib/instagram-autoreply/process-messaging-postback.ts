import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getNextStepForPostback, sendFlowStepToUser } from './dm-flow';
import { parseIgDmFlow, parsePostbackPayload } from './dm-flow-types';
import { decryptIgToken } from './token-crypto';
import type { IgConnectedAccountRow } from './types';

export type MetaMessagingPostback = {
  sender?: { id?: string };
  recipient?: { id?: string };
  postback?: {
    payload?: string;
    title?: string;
  };
};

export async function processInstagramMessagingPostback(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    messaging: MetaMessagingPostback;
  },
): Promise<void> {
  const senderId = params.messaging.sender?.id?.trim();
  const payload = params.messaging.postback?.payload?.trim();
  if (!senderId || !payload) return;

  const parsed = parsePostbackPayload(payload);
  if (!parsed) return;

  const { data: trigger, error: triggerError } = await admin
    .from('ig_triggers')
    .select('*')
    .eq('id', parsed.triggerId)
    .eq('account_id', params.igAccount.account_id)
    .eq('is_active', true)
    .maybeSingle();

  if (triggerError || !trigger) return;

  const flow = parseIgDmFlow((trigger as { dm_flow: unknown }).dm_flow);
  if (!flow) return;

  const nextStep = getNextStepForPostback(flow, parsed.fromStepId);
  if (!nextStep) return;

  const { data: session } = await admin
    .from('ig_dm_sessions')
    .select('id, comment_event_id')
    .eq('ig_account_id', params.igAccount.id)
    .eq('commenter_ig_id', senderId)
    .eq('trigger_id', parsed.triggerId)
    .eq('status', 'active')
    .maybeSingle();

  let accessToken: string;
  try {
    accessToken = decryptIgToken(params.igAccount.access_token);
  } catch {
    console.error('[instagram-webhook] postback token decrypt failed');
    return;
  }

  try {
    await sendFlowStepToUser({
      igBusinessAccountId: params.igAccount.ig_business_account_id,
      recipientIgId: senderId,
      accessToken,
      triggerId: parsed.triggerId,
      step: nextStep,
    });
  } catch (error) {
    console.error(
      '[instagram-webhook] postback reply failed',
      error instanceof Error ? error.message : error,
    );
    return;
  }

  const isFinal =
    flow.steps.findIndex((s) => s.id === nextStep.id) === flow.steps.length - 1;

  if (session) {
    await admin
      .from('ig_dm_sessions')
      .update({
        current_step_id: nextStep.id,
        status: isFinal ? 'completed' : 'active',
      })
      .eq('id', (session as { id: string }).id);

    const commentEventId = (session as { comment_event_id: string | null })
      .comment_event_id;
    if (commentEventId && isFinal) {
      await admin
        .from('ig_comment_events')
        .update({
          dm_content: nextStep.message,
        })
        .eq('id', commentEventId);
    }
  }
}
