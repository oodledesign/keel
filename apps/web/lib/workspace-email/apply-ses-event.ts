import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type RecipientEngagementRow,
  type SummaryCounts,
  buildRecipientEngagementPatch,
  buildSummaryCountPatch,
} from './engagement-patches';
import type { ApplySesEventResult, ParsedSesEvent } from './ses-event-types';

type RecipientMatch =
  | {
      source: 'campaign';
      accountId: string;
      campaignId: string;
      recipientId: string;
    }
  | {
      source: 'circulation';
      accountId: string;
      sendId: string;
      recipientId: string;
    };

function adminDb(client: SupabaseClient) {
  // Tables may be ahead of generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

function asEngagementRow(row: Record<string, unknown>): RecipientEngagementRow {
  return {
    delivered_at: (row.delivered_at as string | null) ?? null,
    opened_at: (row.opened_at as string | null) ?? null,
    open_count: Number(row.open_count ?? 0),
    clicked_at: (row.clicked_at as string | null) ?? null,
    click_count: Number(row.click_count ?? 0),
    bounced_at: (row.bounced_at as string | null) ?? null,
    bounce_type: (row.bounce_type as string | null) ?? null,
    bounce_subtype: (row.bounce_subtype as string | null) ?? null,
    complaint_at: (row.complaint_at as string | null) ?? null,
  };
}

function asSummaryCounts(row: Record<string, unknown>): SummaryCounts {
  return {
    delivered_count: Number(row.delivered_count ?? 0),
    open_count: Number(row.open_count ?? 0),
    click_count: Number(row.click_count ?? 0),
    bounce_count: Number(row.bounce_count ?? 0),
    complaint_count: Number(row.complaint_count ?? 0),
  };
}

async function findRecipientBySesMessageId(
  client: SupabaseClient,
  sesMessageId: string,
): Promise<RecipientMatch | null> {
  const db = adminDb(client);

  const { data: campaignRecipient } = await db
    .from('workspace_email_campaign_recipients')
    .select('id, account_id, campaign_id')
    .eq('ses_message_id', sesMessageId)
    .maybeSingle();

  if (campaignRecipient) {
    return {
      source: 'campaign',
      accountId: String(campaignRecipient.account_id),
      campaignId: String(campaignRecipient.campaign_id),
      recipientId: String(campaignRecipient.id),
    };
  }

  const { data: circulationRecipient } = await db
    .from('commercial_circulation_recipients')
    .select('id, account_id, send_id')
    .eq('ses_message_id', sesMessageId)
    .maybeSingle();

  if (circulationRecipient) {
    return {
      source: 'circulation',
      accountId: String(circulationRecipient.account_id),
      sendId: String(circulationRecipient.send_id),
      recipientId: String(circulationRecipient.id),
    };
  }

  return null;
}

async function insertEventRow(
  client: SupabaseClient,
  input: {
    match: RecipientMatch;
    event: ParsedSesEvent;
    snsMessageId: string | null;
  },
): Promise<'inserted' | 'duplicate'> {
  const db = adminDb(client);
  const { match, event, snsMessageId } = input;

  const row = {
    account_id: match.accountId,
    source: match.source,
    campaign_id: match.source === 'campaign' ? match.campaignId : null,
    campaign_recipient_id:
      match.source === 'campaign' ? match.recipientId : null,
    circulation_send_id: match.source === 'circulation' ? match.sendId : null,
    circulation_recipient_id:
      match.source === 'circulation' ? match.recipientId : null,
    ses_message_id: event.sesMessageId,
    event_type: event.eventType,
    event_at: event.eventAt,
    link_url: event.linkUrl,
    bounce_type: event.bounceType,
    bounce_subtype: event.bounceSubtype,
    complaint_feedback_type: event.complaintFeedbackType,
    sns_message_id: snsMessageId,
    raw_metadata: event.raw,
  };

  const { error } = await db.from('workspace_email_events').insert(row);

  if (!error) return 'inserted';

  if (
    error.code === '23505' ||
    /duplicate key|unique constraint/i.test(error.message ?? '')
  ) {
    return 'duplicate';
  }

  throw new Error(error.message ?? 'Failed to insert workspace_email_events');
}

async function applyRecipientAndSummary(
  client: SupabaseClient,
  match: RecipientMatch,
  event: ParsedSesEvent,
) {
  const db = adminDb(client);
  const recipientTable =
    match.source === 'campaign'
      ? 'workspace_email_campaign_recipients'
      : 'commercial_circulation_recipients';
  const parentTable =
    match.source === 'campaign'
      ? 'workspace_email_campaigns'
      : 'commercial_circulation_sends';
  const parentId =
    match.source === 'campaign' ? match.campaignId : match.sendId;

  const { data: current } = await db
    .from(recipientTable)
    .select(
      'delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, bounce_subtype, complaint_at',
    )
    .eq('id', match.recipientId)
    .maybeSingle();

  if (!current) return;

  const { patch, bumpSummary } = buildRecipientEngagementPatch(
    asEngagementRow(current as Record<string, unknown>),
    {
      eventType: event.eventType,
      eventAt: event.eventAt,
      bounceType: event.bounceType,
      bounceSubtype: event.bounceSubtype,
    },
  );

  if (Object.keys(patch).length > 0) {
    await db.from(recipientTable).update(patch).eq('id', match.recipientId);
  }

  if (!bumpSummary) return;

  const { data: parent } = await db
    .from(parentTable)
    .select(
      'delivered_count, open_count, click_count, bounce_count, complaint_count',
    )
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) return;

  const summaryPatch = buildSummaryCountPatch(
    asSummaryCounts(parent as Record<string, unknown>),
    event.eventType,
    true,
  );

  if (Object.keys(summaryPatch).length > 0) {
    await db.from(parentTable).update(summaryPatch).eq('id', parentId);
  }
}

/**
 * Idempotently apply a parsed SES event to campaign or circulation rows.
 */
export async function applyParsedSesEvent(
  client: SupabaseClient,
  event: ParsedSesEvent,
  options?: { snsMessageId?: string | null },
): Promise<ApplySesEventResult> {
  const match = await findRecipientBySesMessageId(client, event.sesMessageId);
  if (!match) {
    return { applied: false, reason: 'unmatched' };
  }

  const insertResult = await insertEventRow(client, {
    match,
    event,
    snsMessageId: options?.snsMessageId ?? null,
  });

  if (insertResult === 'duplicate') {
    return { applied: false, reason: 'duplicate' };
  }

  if (
    event.eventType === 'delivery' ||
    event.eventType === 'open' ||
    event.eventType === 'click' ||
    event.eventType === 'bounce' ||
    event.eventType === 'complaint'
  ) {
    await applyRecipientAndSummary(client, match, event);
  }

  return {
    applied: true,
    source: match.source,
    eventType: event.eventType,
    recipientId: match.recipientId,
  };
}
