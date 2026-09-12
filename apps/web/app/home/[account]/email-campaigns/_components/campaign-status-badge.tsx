import { cn } from '@kit/ui/utils';

import {
  campaignStatusBadgeClass,
  campaignStatusLabel,
  campaignSubscriberStatusBadgeClass,
  campaignSubscriberStatusLabel,
} from '~/lib/campaigns/campaign-status';
import type {
  CampaignSubscriberStatus,
  EmailCampaignStatus,
} from '~/lib/campaigns/campaign.types';

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: EmailCampaignStatus | string;
  className?: string;
}) {
  return (
    <span
      data-test={`campaign-status-${status}`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        campaignStatusBadgeClass(status),
        className,
      )}
    >
      {campaignStatusLabel(status)}
    </span>
  );
}

export function CampaignSubscriberStatusBadge({
  status,
  className,
}: {
  status: CampaignSubscriberStatus | string;
  className?: string;
}) {
  return (
    <span
      data-test={`campaign-subscriber-status-${status}`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        campaignSubscriberStatusBadgeClass(status),
        className,
      )}
    >
      {campaignSubscriberStatusLabel(status)}
    </span>
  );
}
