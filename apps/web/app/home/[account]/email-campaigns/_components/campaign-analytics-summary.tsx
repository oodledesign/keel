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

type MetricTone =
  | 'sent'
  | 'delivered'
  | 'opens'
  | 'clicks'
  | 'bounces'
  | 'complaints'
  | 'unsubscribes';

const METRIC_TONE: Record<MetricTone, { card: string; dot: string }> = {
  sent: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-accent)_10%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-accent)]',
  },
  delivered: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-sage-500)_12%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-sage-500)]',
  },
  opens: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-info)_12%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-info)]',
  },
  clicks: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-gold-500)_16%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-gold-500)]',
  },
  bounces: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-coral-400)_14%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-coral-400)]',
  },
  complaints: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-coral-600)_14%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-coral-600)]',
  },
  unsubscribes: {
    card: 'bg-[color-mix(in_srgb,var(--ozer-text-muted)_12%,var(--workspace-shell-panel))]',
    dot: 'bg-[var(--ozer-text-muted)]',
  },
};

function Card({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: MetricTone;
}) {
  const palette = METRIC_TONE[tone];
  return (
    <div
      className={`rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3 ${palette.card}`}
    >
      <p
        className={`flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase ${workspaceTextMuted}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-1.5 rounded-full ${palette.dot}`}
        />
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
        <Card label="Sent" value={rates.sent} tone="sent" />
        <Card
          label="Delivered"
          value={rates.delivered}
          hint={growth ? formatRate(rates.deliveryRate) : undefined}
          tone="delivered"
        />
        <Card
          label="Opens"
          value={campaign.openCount}
          hint={`${rates.uniqueOpens} unique${growth ? ` · ${formatRate(rates.openRate)}` : ''}`}
          tone="opens"
        />
        <Card
          label="Clicks"
          value={campaign.clickCount}
          hint={`${rates.uniqueClicks} unique${growth ? ` · ${formatRate(rates.clickRate)}` : ''}`}
          tone="clicks"
        />
        <Card
          label="Bounces"
          value={rates.bounces}
          hint={growth ? formatRate(rates.bounceRate) : undefined}
          tone="bounces"
        />
        <Card
          label="Complaints"
          value={rates.complaints}
          hint={growth ? formatRate(rates.complaintRate) : undefined}
          tone="complaints"
        />
        <Card
          label="Unsubscribes"
          value={rates.unsubscribes}
          hint={growth ? formatRate(rates.unsubscribeRate) : undefined}
          tone="unsubscribes"
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
