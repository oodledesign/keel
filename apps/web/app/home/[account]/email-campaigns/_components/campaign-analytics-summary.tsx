import type {
  EmailCampaign,
  EmailCampaignRecipient,
} from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-3">
      <p
        className={`text-xs font-medium tracking-wide uppercase ${workspaceTextMuted}`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${workspaceText}`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>{hint}</p>
      ) : null}
    </div>
  );
}

export function CampaignAnalyticsSummary({
  campaign,
  recipients,
}: {
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
}) {
  const uniqueOpens = recipients.filter((row) => row.openedAt).length;
  const uniqueClicks = recipients.filter((row) => row.clickedAt).length;

  return (
    <div className={`${workspacePanelCard} space-y-3 p-4`}>
      <div>
        <h3 className={`font-semibold ${workspaceText}`}>Analytics</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          SES events for this campaign. Opens/clicks need configuration-set
          tracking (SNS event destination). Delivery, bounces, and complaints
          work as soon as SES publishes those events.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card label="Sent" value={campaign.sentCount} />
        <Card label="Delivered" value={campaign.deliveredCount} />
        <Card
          label="Opens"
          value={campaign.openCount}
          hint={`${uniqueOpens} unique`}
        />
        <Card
          label="Clicks"
          value={campaign.clickCount}
          hint={`${uniqueClicks} unique`}
        />
        <Card label="Bounces" value={campaign.bounceCount} />
        <Card label="Complaints" value={campaign.complaintCount} />
        <Card label="Unsubscribes" value={campaign.unsubscribedCount} />
      </div>
    </div>
  );
}
