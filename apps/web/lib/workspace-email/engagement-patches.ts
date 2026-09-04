import type { WorkspaceEmailEventType } from './ses-event-types';

export type RecipientEngagementRow = {
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  bounced_at: string | null;
  bounce_type: string | null;
  bounce_subtype: string | null;
  complaint_at: string | null;
};

export type EngagementEventInput = {
  eventType: WorkspaceEmailEventType;
  eventAt: string;
  bounceType?: string | null;
  bounceSubtype?: string | null;
};

export type RecipientPatchResult = {
  patch: Partial<RecipientEngagementRow>;
  /** True when this event newly sets first-seen delivery/bounce/complaint/open/click */
  isFirstOfKind: boolean;
  /** True when parent summary counters should increment */
  bumpSummary: boolean;
};

/**
 * Pure helper: compute denormalized recipient column updates for one SES event.
 * Safe to unit-test without Supabase / node:crypto.
 */
export function buildRecipientEngagementPatch(
  current: RecipientEngagementRow,
  event: EngagementEventInput,
): RecipientPatchResult {
  const patch: Partial<RecipientEngagementRow> = {};
  let isFirstOfKind = false;

  switch (event.eventType) {
    case 'delivery':
      if (!current.delivered_at) {
        patch.delivered_at = event.eventAt;
        isFirstOfKind = true;
      }
      break;
    case 'open':
      patch.open_count = Number(current.open_count ?? 0) + 1;
      if (!current.opened_at) {
        patch.opened_at = event.eventAt;
        isFirstOfKind = true;
      }
      break;
    case 'click':
      patch.click_count = Number(current.click_count ?? 0) + 1;
      if (!current.clicked_at) {
        patch.clicked_at = event.eventAt;
        isFirstOfKind = true;
      }
      break;
    case 'bounce':
      if (!current.bounced_at) {
        patch.bounced_at = event.eventAt;
        patch.bounce_type = event.bounceType ?? null;
        patch.bounce_subtype = event.bounceSubtype ?? null;
        isFirstOfKind = true;
      }
      break;
    case 'complaint':
      if (!current.complaint_at) {
        patch.complaint_at = event.eventAt;
        isFirstOfKind = true;
      }
      break;
    default:
      break;
  }

  const bumpSummary =
    (event.eventType === 'delivery' ||
      event.eventType === 'bounce' ||
      event.eventType === 'complaint') &&
    isFirstOfKind
      ? true
      : event.eventType === 'open' || event.eventType === 'click'
        ? Object.keys(patch).length > 0
        : false;

  return { patch, isFirstOfKind, bumpSummary };
}

export type SummaryCounts = {
  delivered_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  complaint_count: number;
};

/**
 * Pure helper: bump parent send/campaign summary counters.
 * Unique recipients for delivery/bounce/complaint; total events for open/click.
 */
export function buildSummaryCountPatch(
  current: SummaryCounts,
  eventType: WorkspaceEmailEventType,
  bump: boolean,
): Partial<SummaryCounts> {
  if (!bump) return {};

  switch (eventType) {
    case 'delivery':
      return { delivered_count: current.delivered_count + 1 };
    case 'open':
      return { open_count: current.open_count + 1 };
    case 'click':
      return { click_count: current.click_count + 1 };
    case 'bounce':
      return { bounce_count: current.bounce_count + 1 };
    case 'complaint':
      return { complaint_count: current.complaint_count + 1 };
    default:
      return {};
  }
}

/** Events that should only be inserted once per ses_message_id. */
export function isOncePerMessageEventType(
  eventType: WorkspaceEmailEventType,
): boolean {
  return (
    eventType === 'send' ||
    eventType === 'delivery' ||
    eventType === 'bounce' ||
    eventType === 'complaint' ||
    eventType === 'reject'
  );
}
