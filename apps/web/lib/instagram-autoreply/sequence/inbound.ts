import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { parsePostbackPayload } from '../dm-flow-types';
import { getIgUserProfile, sendIgMessage } from '../graph-api';
import {
  type IgInboundTriggerEvent,
  findMatchingV2Triggers,
} from '../match-trigger';
import { processInstagramMessagingPostback } from '../process-messaging-postback';
import { decryptIgToken } from '../token-crypto';
import type {
  IgConnectedAccountRow,
  IgContactRow,
  IgRunSource,
  IgTriggerFullRow,
} from '../types';
import { upsertIgContact } from './contacts';
import {
  claimOutboundSend,
  markOutboundFailed,
  markOutboundSent,
  recordInboundEvent,
} from './message-events';
import {
  OPT_IN_CONFIRMATION,
  OPT_OUT_CONFIRMATION,
  isOptInMessage,
  isOptOutMessage,
} from './opt-out-keywords';
import {
  parseEntryPayload,
  parseFollowCheckPayload,
  parseRunPayload,
} from './payload';
import {
  resumeRunFromFollowCheck,
  resumeRunFromPayload,
  resumeRunsFromText,
} from './resume';
import { startIgRun } from './start-run';

export type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    quick_reply?: { payload?: string };
    reply_to?: { story?: { id?: string; url?: string }; mid?: string };
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
  postback?: { mid?: string; payload?: string; title?: string };
  read?: unknown;
  reaction?: unknown;
};

const ACTIVE_RUN_STATUSES = ['active', 'waiting_delay', 'waiting_reply'];

type TriggerWithSteps = IgTriggerFullRow & {
  ig_automation_steps?: Array<{ count: number }>;
};

export async function loadSequenceTriggers(
  admin: SupabaseClient,
  igAccountId: string,
): Promise<IgTriggerFullRow[]> {
  const { data, error } = await admin
    .from('ig_triggers')
    .select('*, ig_automation_steps(count)')
    .eq('ig_account_id', igAccountId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as TriggerWithSteps[])
    .filter((t) => (t.ig_automation_steps?.[0]?.count ?? 0) > 0)
    .map(({ ig_automation_steps: _steps, ...trigger }) => {
      void _steps;
      return trigger as IgTriggerFullRow;
    });
}

/**
 * Start the first matching automation for an event. Returns true if a run was
 * started (or the event was a replay of one that already started).
 */
export async function startMatchingAutomation(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    event: IgInboundTriggerEvent;
    source: IgRunSource;
    sourceEventId: string;
    sourceCommentId?: string | null;
    triggers?: IgTriggerFullRow[];
  },
): Promise<{ triggerId: string; runId: string | null } | null> {
  const triggers =
    params.triggers ?? (await loadSequenceTriggers(admin, params.igAccount.id));

  for (const trigger of findMatchingV2Triggers(triggers, params.event)) {
    const result = await startIgRun(admin, {
      trigger,
      igAccount: params.igAccount,
      contact: params.contact,
      source: params.source,
      sourceEventId: params.sourceEventId,
      sourceCommentId: params.sourceCommentId,
    });
    if (result.status === 'started') {
      return { triggerId: trigger.id, runId: result.runId };
    }
    if (result.status === 'duplicate') {
      return { triggerId: trigger.id, runId: null };
    }
    // Skipped (once per contact / cooldown): let a lower-priority trigger try.
  }
  return null;
}

async function sendSystemMessage(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    idempotencyKey: string;
    text: string;
  },
) {
  const claim = await claimOutboundSend(
    admin,
    {
      accountId: params.igAccount.account_id,
      igAccountId: params.igAccount.id,
      contactId: params.contact.id,
    },
    {
      idempotencyKey: params.idempotencyKey,
      eventType: 'system',
      body: params.text,
    },
  );
  if (claim.kind !== 'claimed') return;

  try {
    const accessToken = decryptIgToken(params.igAccount.access_token);
    const result = await sendIgMessage(
      params.igAccount.ig_business_account_id,
      accessToken,
      {
        recipient: { id: params.contact.igsid },
        message: { text: params.text },
      },
    );
    await markOutboundSent(admin, claim.eventId, result.messageId);
  } catch (error) {
    await markOutboundFailed(admin, claim.eventId, error, 'failed');
  }
}

export async function applyOptOut(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    sourceEventId: string;
  },
) {
  const now = new Date().toISOString();
  const alreadyOptedOut = Boolean(params.contact.opted_out_at);

  await admin
    .from('ig_contacts')
    .update({ opted_out_at: params.contact.opted_out_at ?? now })
    .eq('id', params.contact.id);

  await admin
    .from('ig_automation_runs')
    .update({
      status: 'stopped',
      last_error: 'Contact opted out',
      completed_at: now,
      next_step_at: null,
      awaiting: null,
    })
    .eq('contact_id', params.contact.id)
    .in('status', ACTIVE_RUN_STATUSES);

  if (!alreadyOptedOut) {
    await sendSystemMessage(admin, {
      igAccount: params.igAccount,
      contact: params.contact,
      idempotencyKey: `optout:${params.sourceEventId}`,
      text: OPT_OUT_CONFIRMATION,
    });
  }
}

async function applyOptIn(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    sourceEventId: string;
  },
) {
  if (!params.contact.opted_out_at) return;
  await admin
    .from('ig_contacts')
    .update({ opted_out_at: null })
    .eq('id', params.contact.id);
  await sendSystemMessage(admin, {
    igAccount: params.igAccount,
    contact: params.contact,
    idempotencyKey: `optin:${params.sourceEventId}`,
    text: OPT_IN_CONFIRMATION,
  });
}

/** Best effort: fill username/name for people who DM before commenting. */
async function enrichContactProfile(
  admin: SupabaseClient,
  igAccount: IgConnectedAccountRow,
  contact: IgContactRow,
): Promise<IgContactRow> {
  try {
    const profile = await getIgUserProfile(
      contact.igsid,
      decryptIgToken(igAccount.access_token),
    );
    const patch: Record<string, unknown> = {
      username: profile.username,
      display_name: contact.display_name ?? profile.name,
    };
    if (profile.isUserFollowBusiness !== null) {
      patch.is_follower = profile.isUserFollowBusiness;
      patch.is_follower_checked_at = new Date().toISOString();
    }
    const { data } = await admin
      .from('ig_contacts')
      .update(patch)
      .eq('id', contact.id)
      .select('*')
      .single();
    return (data as IgContactRow | null) ?? contact;
  } catch {
    return contact;
  }
}

async function isFirstInboundMessage(
  admin: SupabaseClient,
  contactId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('ig_message_events')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .in('event_type', [
      'message',
      'quick_reply',
      'story_reply',
      'story_mention',
    ]);
  return (count ?? 0) <= 1;
}

async function handlePayload(
  admin: SupabaseClient,
  params: {
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    payload: string;
    eventId: string;
    messaging: MetaMessagingEvent;
  },
): Promise<boolean> {
  const { payload, contact } = params;
  if (contact.opted_out_at) return true;

  const run = parseRunPayload(payload);
  if (run) {
    await resumeRunFromPayload(admin, {
      contactId: contact.id,
      payload: run,
      messageId: params.eventId,
    });
    return true;
  }

  const followRunId = parseFollowCheckPayload(payload);
  if (followRunId) {
    await resumeRunFromFollowCheck(admin, {
      contactId: contact.id,
      runId: followRunId,
    });
    return true;
  }

  const entryTriggerId = parseEntryPayload(payload);
  if (entryTriggerId) {
    const { data: trigger } = await admin
      .from('ig_triggers')
      .select('*')
      .eq('id', entryTriggerId)
      .eq('ig_account_id', params.igAccount.id)
      .eq('is_active', true)
      .maybeSingle();
    const entry = trigger as IgTriggerFullRow | null;
    if (
      entry &&
      (entry.trigger_type === 'ice_breaker' ||
        entry.trigger_type === 'menu_payload')
    ) {
      await startIgRun(admin, {
        trigger: entry,
        igAccount: params.igAccount,
        contact,
        source: entry.trigger_type === 'ice_breaker' ? 'ice_breaker' : 'menu',
        sourceEventId: params.eventId,
      });
    }
    return true;
  }

  if (parsePostbackPayload(payload)) {
    await processInstagramMessagingPostback(admin, {
      igAccount: params.igAccount,
      messaging: {
        sender: params.messaging.sender,
        recipient: params.messaging.recipient,
        postback: { payload },
      },
    });
    return true;
  }

  return false;
}

/**
 * Route one `messaging[]` webhook item: DMs, quick reply taps, story replies,
 * story mentions and button/menu/ice breaker postbacks. Echoes of our own
 * messages and read/reaction receipts are ignored.
 */
export async function processInstagramMessagingEvent(
  admin: SupabaseClient,
  params: { igAccount: IgConnectedAccountRow; messaging: MetaMessagingEvent },
): Promise<void> {
  const { igAccount, messaging } = params;
  const senderId = messaging.sender?.id?.trim();
  if (!senderId || senderId === igAccount.ig_business_account_id) return;

  const message = messaging.message;
  const postback = messaging.postback;
  if (message?.is_echo || message?.is_deleted) return;
  if (!message && !postback?.payload) return;

  const timestamp =
    typeof messaging.timestamp === 'number' &&
    Number.isFinite(messaging.timestamp)
      ? messaging.timestamp
      : Date.now();
  const inboundAt = new Date(Math.min(timestamp, Date.now())).toISOString();

  let contact = await upsertIgContact(admin, {
    igAccount,
    igsid: senderId,
    inboundAt,
  });
  if (!contact.username) {
    contact = await enrichContactProfile(admin, igAccount, contact);
  }

  const ctx = {
    accountId: igAccount.account_id,
    igAccountId: igAccount.id,
    contactId: contact.id,
  };

  if (postback?.payload) {
    const payload = postback.payload.trim();
    const eventId = postback.mid ?? `${senderId}:${timestamp}:${payload}`;
    const fresh = await recordInboundEvent(admin, ctx, {
      idempotencyKey: `in:postback:${eventId}`,
      eventType: 'postback',
      body: postback.title ?? null,
      payload,
      metaMessageId: postback.mid ?? null,
    });
    if (!fresh) return;
    await handlePayload(admin, {
      igAccount,
      contact,
      payload,
      eventId,
      messaging,
    });
    return;
  }

  if (!message?.mid) return;
  const mid = message.mid;
  const text = message.text?.trim() ?? '';
  const quickReplyPayload = message.quick_reply?.payload?.trim();
  const storyReply = message.reply_to?.story;
  const isStoryMention = (message.attachments ?? []).some(
    (a) => a.type === 'story_mention',
  );

  const eventType = quickReplyPayload
    ? 'quick_reply'
    : isStoryMention
      ? 'story_mention'
      : storyReply
        ? 'story_reply'
        : 'message';

  const fresh = await recordInboundEvent(admin, ctx, {
    idempotencyKey: `in:msg:${mid}`,
    eventType,
    body: text || (message.attachments?.length ? '[attachment]' : null),
    payload: quickReplyPayload ?? null,
    metaMessageId: mid,
  });
  if (!fresh) return;

  if (isOptOutMessage(text)) {
    await applyOptOut(admin, { igAccount, contact, sourceEventId: mid });
    return;
  }
  if (isOptInMessage(text)) {
    await applyOptIn(admin, { igAccount, contact, sourceEventId: mid });
    return;
  }
  if (contact.opted_out_at || contact.handoff_at) return;

  if (quickReplyPayload) {
    const handled = await handlePayload(admin, {
      igAccount,
      contact,
      payload: quickReplyPayload,
      eventId: mid,
      messaging,
    });
    if (handled) return;
  }

  if (
    await resumeRunsFromText(admin, {
      contactId: contact.id,
      text,
      messageId: mid,
    })
  ) {
    return;
  }

  const event: IgInboundTriggerEvent = isStoryMention
    ? { kind: 'story_mention' }
    : storyReply
      ? { kind: 'story_reply', text, storyId: storyReply.id ?? null }
      : {
          kind: 'dm',
          text,
          isFirstMessage: await isFirstInboundMessage(admin, contact.id),
        };

  await startMatchingAutomation(admin, {
    igAccount,
    contact,
    event,
    source: isStoryMention
      ? 'story_mention'
      : storyReply
        ? 'story_reply'
        : 'message',
    sourceEventId: mid,
  });
}
