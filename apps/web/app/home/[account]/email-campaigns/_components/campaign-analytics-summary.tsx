import { pickAbWinner, summarizeAbVariants } from '~/lib/campaigns/campaign-ab';
import type { CampaignAnalyticsEvent } from '~/lib/campaigns/campaign-analytics';
import {
  buildCampaignAnalyticsView,
  formatCampaignRate,
} from '~/lib/campaigns/campaign-analytics';
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
  recipients,
  events,
  richAnalytics,
}: {
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
  events: CampaignAnalyticsEvent[];
  richAnalytics: boolean;
}) {
  const view = buildCampaignAnalyticsView({ campaign, recipients, events });
  const variants = campaign.abEnabled
    ? summarizeAbVariants({
        subjectA: campaign.subject,
        subjectB: campaign.subjectB ?? '',
        recipients: recipients.map((row) => ({
          subjectVariant: row.subjectVariant,
          status: row.status,
          openedAt: row.openedAt,
          clickedAt: row.clickedAt,
          bouncedAt: row.bouncedAt,
          complaintAt: row.complaintAt,
          deliveredAt: row.deliveredAt,
        })),
      })
    : [];
  const winner = campaign.abEnabled ? pickAbWinner(variants) : null;

  return (
    <div className={`${workspacePanelCard} space-y-4 p-4`}>
      <div>
        <h3 className={`font-semibold ${workspaceText}`}>Analytics</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          SES events for this campaign. Rates use delivered when available,
          otherwise sent. Opens/clicks need configuration-set tracking.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card label="Sent" value={campaign.sentCount} />
        <Card
          label="Delivered"
          value={campaign.deliveredCount}
          hint={formatCampaignRate(view.rates.delivery)}
        />
        <Card
          label="Opens"
          value={campaign.openCount}
          hint={`${view.uniqueOpens} unique · ${formatCampaignRate(view.rates.uniqueOpen)}`}
        />
        <Card
          label="Clicks"
          value={campaign.clickCount}
          hint={`${view.uniqueClicks} unique · ${formatCampaignRate(view.rates.uniqueClick)}`}
        />
        <Card
          label="Bounces"
          value={campaign.bounceCount}
          hint={formatCampaignRate(view.rates.bounce)}
        />
        <Card
          label="Complaints"
          value={campaign.complaintCount}
          hint={formatCampaignRate(view.rates.complaint)}
        />
        <Card label="Unsubscribes" value={campaign.unsubscribedCount} />
      </div>

      {campaign.abEnabled && variants.length > 0 ? (
        <div className="space-y-2">
          <h4 className={`text-sm font-semibold ${workspaceText}`}>
            A/B subjects
            {winner ? (
              <span className={`ml-2 font-normal ${workspaceTextMuted}`}>
                Winner: subject {winner.toUpperCase()}
              </span>
            ) : (
              <span className={`ml-2 font-normal ${workspaceTextMuted}`}>
                No winner yet
              </span>
            )}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {variants.map((row) => (
              <div
                key={row.variant}
                className="rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3"
              >
                <p className={`text-sm font-medium ${workspaceText}`}>
                  Subject {row.variant.toUpperCase()}
                  {winner === row.variant ? ' · winner' : ''}
                </p>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  {row.subject || '—'}
                </p>
                <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
                  {row.sent} sent · {row.delivered} delivered ·{' '}
                  {row.uniqueOpens} unique opens (
                  {formatCampaignRate(row.openRate)}) · {row.uniqueClicks}{' '}
                  unique clicks ({formatCampaignRate(row.clickRate)})
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {richAnalytics ? (
        <>
          {view.timeSeries.length > 0 ? (
            <div>
              <h4 className={`text-sm font-semibold ${workspaceText}`}>
                Daily events
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className={workspaceTextMuted}>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Delivered</th>
                      <th className="pb-2 font-medium">Opens</th>
                      <th className="pb-2 font-medium">Clicks</th>
                      <th className="pb-2 font-medium">Bounces</th>
                      <th className="pb-2 font-medium">Complaints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.timeSeries.map((point) => (
                      <tr
                        key={point.date}
                        className="border-t border-[color:var(--workspace-shell-border)]"
                      >
                        <td className={`py-1.5 ${workspaceText}`}>
                          {point.date}
                        </td>
                        <td className={workspaceText}>{point.deliveries}</td>
                        <td className={workspaceText}>{point.opens}</td>
                        <td className={workspaceText}>{point.clicks}</td>
                        <td className={workspaceText}>{point.bounces}</td>
                        <td className={workspaceText}>{point.complaints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view.linkClicks.length > 0 ? (
            <div>
              <h4 className={`text-sm font-semibold ${workspaceText}`}>
                Link clicks
              </h4>
              <ul className="mt-2 space-y-1">
                {view.linkClicks.map((row) => (
                  <li
                    key={row.url}
                    className={`truncate text-sm ${workspaceTextMuted}`}
                  >
                    <span className={`font-medium ${workspaceText}`}>
                      {row.clicks}
                    </span>{' '}
                    · {row.url}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.bounceBreakdown.length > 0 ? (
            <div>
              <h4 className={`text-sm font-semibold ${workspaceText}`}>
                Bounce types
              </h4>
              <ul className="mt-2 space-y-1">
                {view.bounceBreakdown.map((row) => (
                  <li
                    key={row.type}
                    className={`text-sm ${workspaceTextMuted}`}
                  >
                    {row.type}: {row.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Daily events, per-link clicks, and bounce breakdowns are on Growth and
          Pro.
        </p>
      )}
    </div>
  );
}
