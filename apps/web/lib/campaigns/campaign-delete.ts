import type { EmailCampaign, EmailCampaignStatus } from './campaign.types';

const HISTORY_INSTANCE_STATUSES = new Set<EmailCampaignStatus>([
  'sent',
  'failed',
]);

export const CAMPAIGN_SENDING_DELETE_ERROR =
  'This campaign is still sending. Try again when it finishes.';

export const SERIES_SENDING_DELETE_ERROR =
  'An occurrence is still sending. Try again when it finishes.';

export const SERIES_INSTANCE_DELETE_ERROR =
  'This is a recurring occurrence. Skip this week, or delete the series.';

export type SeriesDeleteInstance = {
  id: string;
  status: EmailCampaign['status'] | string;
  sentCount?: number;
  sentAt?: string | null;
};

export type SeriesDeletePlan = {
  deleteInstanceIds: string[];
  hadSends: boolean;
};

export function campaignHasSendHistory(input: {
  status: EmailCampaign['status'] | string;
  sentCount?: number;
  sentAt?: string | null;
}): boolean {
  return (
    input.status === 'sent' ||
    input.status === 'failed' ||
    (input.sentCount ?? 0) > 0 ||
    Boolean(input.sentAt)
  );
}

/** One-off campaigns only. Series occurrences are skipped or deleted via the series. */
export function assertCampaignDeletable(campaign: {
  status: EmailCampaign['status'] | string;
  seriesId: string | null;
}): void {
  if (campaign.status === 'sending') {
    throw new Error(CAMPAIGN_SENDING_DELETE_ERROR);
  }
  if (campaign.seriesId) {
    throw new Error(SERIES_INSTANCE_DELETE_ERROR);
  }
}

/**
 * Hard-delete unsent occurrences so cron cannot send them. Keep sent/failed
 * rows so recipient logs stay after the series row is removed (series_id
 * SET NULL).
 */
export function planSeriesDelete(
  instances: SeriesDeleteInstance[],
): SeriesDeletePlan {
  if (instances.some((row) => row.status === 'sending')) {
    throw new Error(SERIES_SENDING_DELETE_ERROR);
  }

  return {
    deleteInstanceIds: instances
      .filter((row) => {
        return !HISTORY_INSTANCE_STATUSES.has(
          row.status as EmailCampaignStatus,
        );
      })
      .map((row) => row.id),
    hadSends: instances.some((row) => campaignHasSendHistory(row)),
  };
}
