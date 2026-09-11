import { formatOccurrenceLabel } from '~/lib/campaigns/campaign-recurrence';
import { recurringInstanceStatus } from '~/lib/campaigns/campaign-series-ready';
import { formatZonedInstant } from '~/lib/campaigns/campaign-timezone';
import type {
  EmailCampaign,
  EmailCampaignSeries,
} from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignInstanceActions } from './campaign-instance-actions';
import { CampaignStatusBadge } from './campaign-status-badge';

export function CampaignInstanceBanner({
  accountId,
  accountSlug,
  campaign,
  series,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  series: EmailCampaignSeries;
}) {
  const planner = recurringInstanceStatus(campaign);
  const when = campaign.occurrenceKey
    ? formatOccurrenceLabel(campaign.occurrenceKey, series.timezone)
    : campaign.name;

  return (
    <div
      className={`${workspacePanelCard} flex flex-wrap items-start justify-between gap-3 p-4`}
      data-test="campaign-instance-banner"
    >
      <div>
        <p className={`text-sm font-medium ${workspaceText}`}>
          {series.name} · {when}
        </p>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          {campaign.scheduledAt
            ? `Sends ${formatZonedInstant(campaign.scheduledAt, series.timezone)} if Ready.`
            : 'This week is a draft in the series.'}{' '}
          It will not send until you mark it Ready.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <CampaignStatusBadge status={planner} />
        <CampaignInstanceActions
          accountId={accountId}
          accountSlug={accountSlug}
          seriesId={series.id}
          campaignId={campaign.id}
          status={campaign.status}
          ready={campaign.ready}
          compact
        />
      </div>
    </div>
  );
}
