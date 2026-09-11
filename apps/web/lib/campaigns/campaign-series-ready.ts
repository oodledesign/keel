import type { EmailCampaignStatus } from './campaign.types';

const SENDABLE_STATUSES = new Set<EmailCampaignStatus>(['draft', 'scheduled']);

/**
 * Series instances must be marked Ready before compile/send.
 * One-off campaigns keep the existing draft/scheduled behaviour.
 */
export function seriesInstanceMaySend(input: {
  seriesId: string | null | undefined;
  ready: boolean;
  status: EmailCampaignStatus | string;
}): boolean {
  if (!SENDABLE_STATUSES.has(input.status as EmailCampaignStatus)) {
    return false;
  }
  if (!input.seriesId) {
    return true;
  }
  return input.ready;
}

export function recurringInstanceStatus(input: {
  status: EmailCampaignStatus | string;
  ready: boolean;
}):
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'skipped'
  | 'failed' {
  if (input.status === 'cancelled') return 'skipped';
  if (
    input.status === 'sending' ||
    input.status === 'sent' ||
    input.status === 'failed'
  ) {
    return input.status;
  }
  if (input.status === 'scheduled' && input.ready) {
    return 'scheduled';
  }
  if (input.ready) return 'ready';
  return 'draft';
}

export const RECURRING_INSTANCE_STATUS_LABEL: Record<
  ReturnType<typeof recurringInstanceStatus>,
  string
> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  skipped: 'Skipped',
  failed: 'Failed',
};
