import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { IgGraphApiError, redactUrls } from '../graph-api';

const BODY_MAX = 2000;
/** A queued send older than this is treated as an unknown outcome and never retried. */
const STALE_QUEUED_MS = 5 * 60 * 1000;

export type IgEventContext = {
  accountId: string;
  igAccountId: string;
  contactId: string | null;
  runId?: string | null;
  triggerId?: string | null;
};

export type ClaimResult =
  | { kind: 'claimed'; eventId: string }
  | { kind: 'already_sent' }
  | { kind: 'in_flight' }
  | { kind: 'unknown_outcome' };

function truncate(text: string | null | undefined) {
  if (!text) return null;
  const clean = redactUrls(text);
  return clean.length > BODY_MAX ? `${clean.slice(0, BODY_MAX)}…` : clean;
}

/**
 * Reserve an outbound send. The unique idempotency_key means a replayed
 * webhook or a second worker can never send the same step twice. A previous
 * attempt that Meta rejected ('failed') may be re-claimed for retry.
 */
export async function claimOutboundSend(
  admin: SupabaseClient,
  ctx: IgEventContext,
  params: {
    idempotencyKey: string;
    eventType: 'step' | 'private_reply' | 'agent' | 'system';
    stepPosition?: number | null;
    stepType?: string | null;
    body?: string | null;
    agentUserId?: string | null;
  },
): Promise<ClaimResult> {
  const { data: inserted, error } = await admin
    .from('ig_message_events')
    .upsert(
      {
        account_id: ctx.accountId,
        ig_account_id: ctx.igAccountId,
        contact_id: ctx.contactId,
        run_id: ctx.runId ?? null,
        trigger_id: ctx.triggerId ?? null,
        idempotency_key: params.idempotencyKey,
        direction: 'outbound',
        event_type: params.eventType,
        step_position: params.stepPosition ?? null,
        step_type: params.stepType ?? null,
        send_status: 'queued',
        body: truncate(params.body),
        agent_user_id: params.agentUserId ?? null,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw new Error(error.message);
  const row = inserted?.[0] as { id: string } | undefined;
  if (row) return { kind: 'claimed', eventId: row.id };

  const { data: existing } = await admin
    .from('ig_message_events')
    .select('id, send_status, updated_at')
    .eq('idempotency_key', params.idempotencyKey)
    .maybeSingle();

  if (!existing) return { kind: 'in_flight' };

  if (existing.send_status === 'sent' || existing.send_status === 'skipped') {
    return { kind: 'already_sent' };
  }

  if (existing.send_status === 'failed') {
    const { data: reclaimed } = await admin
      .from('ig_message_events')
      .update({ send_status: 'queued', error_message: null })
      .eq('id', existing.id)
      .eq('send_status', 'failed')
      .select('id');
    const again = reclaimed?.[0] as { id: string } | undefined;
    return again
      ? { kind: 'claimed', eventId: again.id }
      : { kind: 'in_flight' };
  }

  if (existing.send_status === 'queued') {
    const age = Date.now() - Date.parse(existing.updated_at as string);
    if (age > STALE_QUEUED_MS) {
      await admin
        .from('ig_message_events')
        .update({
          send_status: 'skipped',
          error_message:
            'Delivery state unknown; not retried to avoid a duplicate',
        })
        .eq('id', existing.id)
        .eq('send_status', 'queued');
      return { kind: 'unknown_outcome' };
    }
    return { kind: 'in_flight' };
  }

  return { kind: 'already_sent' };
}

export async function markOutboundSent(
  admin: SupabaseClient,
  eventId: string,
  metaMessageId: string | null,
) {
  await admin
    .from('ig_message_events')
    .update({
      send_status: 'sent',
      meta_message_id: metaMessageId,
      meta_error_code: null,
      meta_error_subcode: null,
      error_message: null,
    })
    .eq('id', eventId);
}

export async function markOutboundFailed(
  admin: SupabaseClient,
  eventId: string,
  error: unknown,
  status: 'failed' | 'window_expired' | 'skipped' = 'failed',
) {
  const graph = error instanceof IgGraphApiError ? error : null;
  const message =
    error instanceof Error ? error.message : 'Instagram send failed';
  await admin
    .from('ig_message_events')
    .update({
      send_status: status,
      meta_error_code: graph?.code ?? null,
      meta_error_subcode: graph?.subcode ?? null,
      error_message: truncate(message),
    })
    .eq('id', eventId);
}

/**
 * Link an inbound tap or answer to the run step it resumed, so funnel
 * analytics can count taps and collected answers per automation.
 */
export async function attributeInboundEvent(
  admin: SupabaseClient,
  params: {
    contactId: string;
    metaMessageId: string | null | undefined;
    runId: string;
    triggerId: string;
    stepPosition: number;
    stepType: string;
  },
) {
  if (!params.metaMessageId) return;
  await admin
    .from('ig_message_events')
    .update({
      run_id: params.runId,
      trigger_id: params.triggerId,
      step_position: params.stepPosition,
      step_type: params.stepType,
    })
    .eq('contact_id', params.contactId)
    .eq('direction', 'inbound')
    .eq('meta_message_id', params.metaMessageId);
}

/**
 * Log an inbound event. Returns false if this webhook event was already
 * recorded (replay), so callers can stop processing.
 */
export async function recordInboundEvent(
  admin: SupabaseClient,
  ctx: IgEventContext,
  params: {
    idempotencyKey: string;
    eventType:
      | 'message'
      | 'quick_reply'
      | 'postback'
      | 'comment'
      | 'story_reply'
      | 'story_mention';
    body?: string | null;
    payload?: string | null;
    metaMessageId?: string | null;
  },
): Promise<boolean> {
  const { data, error } = await admin
    .from('ig_message_events')
    .upsert(
      {
        account_id: ctx.accountId,
        ig_account_id: ctx.igAccountId,
        contact_id: ctx.contactId,
        run_id: ctx.runId ?? null,
        trigger_id: ctx.triggerId ?? null,
        idempotency_key: params.idempotencyKey,
        direction: 'inbound',
        event_type: params.eventType,
        send_status: 'received',
        body: truncate(params.body),
        payload: params.payload?.slice(0, 500) ?? null,
        meta_message_id: params.metaMessageId ?? null,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
