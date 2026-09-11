import type { EmailCampaignStatus } from './campaign.types';

export type CampaignRecipientStatusCounts = {
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
};

export type CampaignSendProgressSnapshot = {
  status: EmailCampaignStatus;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  processedCount: number;
  remainingCount: number;
  lastError: string | null;
};

/**
 * Merge stored campaign counters with live recipient-row counts.
 * Recipient rows update per email; campaign sent_count only updates per batch.
 */
export function buildCampaignSendProgress(input: {
  status: EmailCampaignStatus;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  lastError: string | null;
  recipientCounts?: CampaignRecipientStatusCounts | null;
}): CampaignSendProgressSnapshot {
  const live = input.recipientCounts;
  const sentCount = live ? live.sent : input.sentCount;
  const failedCount = live ? live.failed : input.failedCount;
  const skippedCount = live ? live.skipped : input.skippedCount;
  const remainingCount = live
    ? live.pending
    : Math.max(0, input.audienceCount - sentCount - failedCount - skippedCount);
  const processedCount = sentCount + failedCount + skippedCount;
  const audienceCount = Math.max(
    input.audienceCount,
    processedCount + remainingCount,
  );

  return {
    status: input.status,
    audienceCount,
    sentCount,
    failedCount,
    skippedCount,
    processedCount,
    remainingCount,
    lastError: input.lastError,
  };
}

export function campaignSendProgressPercent(
  progress: Pick<
    CampaignSendProgressSnapshot,
    'processedCount' | 'audienceCount'
  >,
): number | null {
  if (progress.audienceCount <= 0) {
    return null;
  }

  return Math.min(
    100,
    Math.round((progress.processedCount / progress.audienceCount) * 100),
  );
}

export function isCampaignSendInFlight(
  status: EmailCampaignStatus | string,
): boolean {
  return status === 'sending';
}

export function isCampaignSendTerminal(
  status: EmailCampaignStatus | string,
): boolean {
  return status === 'sent' || status === 'failed' || status === 'cancelled';
}
