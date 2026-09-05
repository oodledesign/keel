import {
  hasCampaignsGrowthFeatures,
  hasCampaignsProFeatures,
} from '~/lib/billing/campaign-pricing';
import {
  type CampaignAnalyticsBundle,
  formatRate,
} from '~/lib/campaigns/campaign-analytics';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
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
  value: string | number;
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
  analytics,
  planTier,
  comparative,
}: {
  campaign: EmailCampaign;
  analytics: CampaignAnalyticsBundle;
  planTier: string;
  comparative?: Array<{
    id: string;
    name: string;
    rates: { openRate: number | null; clickRate: number | null; sent: number };
  }>;
}) {
  const growth = hasCampaignsGrowthFeatures(planTier);
  const pro = hasCampaignsProFeatures(planTier);
  const { rates } = analytics;

  return (
    <div className={`${workspacePanelCard} space-y-4 p-4`}>
      <div>
        <h3 className={`font-semibold ${workspaceText}`}>Analytics</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          SES events for this campaign. Opens/clicks need configuration-set
          tracking. Delivery, bounces, and complaints appear as soon as SES
          publishes those events.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card label="Sent" value={rates.sent} />
        <Card
          label="Delivered"
          value={rates.delivered}
          hint={growth ? formatRate(rates.deliveryRate) : undefined}
        />
        <Card
          label="Opens"
          value={campaign.openCount}
          hint={`${rates.uniqueOpens} unique${growth ? ` · ${formatRate(rates.openRate)}` : ''}`}
        />
        <Card
          label="Clicks"
          value={campaign.clickCount}
          hint={`${rates.uniqueClicks} unique${growth ? ` · ${formatRate(rates.clickRate)}` : ''}`}
        />
        <Card
          label="Bounces"
          value={rates.bounces}
          hint={growth ? formatRate(rates.bounceRate) : undefined}
        />
        <Card
          label="Complaints"
          value={rates.complaints}
          hint={growth ? formatRate(rates.complaintRate) : undefined}
        />
        <Card
          label="Unsubscribes"
          value={rates.unsubscribes}
          hint={growth ? formatRate(rates.unsubscribeRate) : undefined}
        />
      </div>

      {growth && analytics.series.length > 0 ? (
        <div>
          <h4 className={`text-sm font-semibold ${workspaceText}`}>
            Engagement over time
          </h4>
          <ul className={`mt-2 space-y-1 text-sm ${workspaceTextMuted}`}>
            {analytics.series.map((point) => (
              <li key={point.date} className="flex justify-between gap-3">
                <span>{point.date}</span>
                <span>
                  {point.opens} opens · {point.clicks} clicks · {point.bounces}{' '}
                  bounces
                  {point.complaints > 0
                    ? ` · ${point.complaints} complaints`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {growth && analytics.links.length > 0 ? (
        <div>
          <h4 className={`text-sm font-semibold ${workspaceText}`}>
            Link clicks
          </h4>
          <ul className={`mt-2 space-y-1 text-sm ${workspaceTextMuted}`}>
            {analytics.links.map((link) => (
              <li key={link.url} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{link.url}</span>
                <span className="tabular-nums">{link.clicks}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {growth && analytics.ab ? (
        <div>
          <h4 className={`text-sm font-semibold ${workspaceText}`}>
            A/B subjects
          </h4>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Winner:{' '}
            {analytics.ab.winner.variant
              ? `Subject ${analytics.ab.winner.variant.toUpperCase()} — ${analytics.ab.winner.reason}`
              : analytics.ab.winner.reason}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {([analytics.ab.a, analytics.ab.b] as const).map((stat) => (
              <div
                key={stat.variant}
                className="rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
              >
                <p className={`font-medium ${workspaceText}`}>
                  Subject {stat.variant.toUpperCase()}
                  {stat.variant === 'a' ? `: ${campaign.subject}` : ''}
                  {stat.variant === 'b' && campaign.subjectB
                    ? `: ${campaign.subjectB}`
                    : ''}
                </p>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  {stat.sent} sent · {formatRate(stat.openRate)} open ·{' '}
                  {formatRate(stat.clickRate)} click
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pro && comparative && comparative.length > 1 ? (
        <div>
          <h4 className={`text-sm font-semibold ${workspaceText}`}>
            Comparative reports
          </h4>
          <ul className={`mt-2 space-y-1 text-sm ${workspaceTextMuted}`}>
            {comparative.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{row.name}</span>
                <span>
                  {row.rates.sent} sent · {formatRate(row.rates.openRate)} open
                  · {formatRate(row.rates.clickRate)} click
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
