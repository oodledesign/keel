'use client';

import Link from 'next/link';

import { CalendarClock, FolderKanban } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  formatOccurrenceLabel,
  seriesRecurrenceSummary,
} from '~/lib/campaigns/campaign-recurrence';
import { recurringInstanceStatus } from '~/lib/campaigns/campaign-series-ready';
import { formatZonedInstant } from '~/lib/campaigns/campaign-timezone';
import type { EmailCampaignSeries } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignInstanceActions } from './campaign-instance-actions';
import { CampaignStatusBadge } from './campaign-status-badge';

type PlannerInstance = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  scheduledTimezone: string;
  ready: boolean;
  occurrenceKey: string | null;
  sentCount: number;
};

export function CampaignsRecurringPlanner({
  accountId,
  accountSlug,
  groups,
}: {
  accountId: string;
  accountSlug: string;
  groups: Array<{
    series: EmailCampaignSeries;
    instances: PlannerInstance[];
  }>;
}) {
  const newHref = pathsConfig.app.accountEmailCampaignRecurringNew.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild className={workspaceBtnPrimary} data-test="series-new">
          <Link href={newHref}>New series</Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-12 text-center`}>
          <FolderKanban className={`mx-auto h-10 w-10 ${workspaceTextMuted}`} />
          <h2 className={`mt-4 text-lg font-semibold ${workspaceText}`}>
            No recurring series yet
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm ${workspaceTextMuted}`}>
            Create a weekly series. Ozer generates the next four drafts. Edit
            each week, then mark it Ready so it can send.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ series, instances }) => {
            const seriesHref = pathsConfig.app.accountEmailCampaignSeriesDetail
              .replace('[account]', accountSlug)
              .replace('[seriesId]', series.id);
            const upcoming = instances.filter((row) => {
              const planner = recurringInstanceStatus(row);
              return (
                planner === 'draft' ||
                planner === 'ready' ||
                planner === 'scheduled'
              );
            });

            return (
              <section
                key={series.id}
                className={`${workspacePanelCard} space-y-4 p-4`}
                data-test="campaign-series-folder"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={seriesHref}
                      className={`font-semibold ${workspaceText} hover:underline`}
                    >
                      {series.name}
                    </Link>
                    <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                      {seriesRecurrenceSummary(series)} · {series.timezone}
                    </p>
                  </div>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {series.status === 'paused' ? 'Paused' : 'Active'}
                  </span>
                </div>

                {upcoming.length === 0 ? (
                  <p className={`text-sm ${workspaceTextMuted}`}>
                    No upcoming drafts. The next occurrences will appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                    {upcoming.map((instance) => {
                      const href = pathsConfig.app.accountEmailCampaignDetail
                        .replace('[account]', accountSlug)
                        .replace('[campaignId]', instance.id);
                      const planner = recurringInstanceStatus(instance);
                      return (
                        <li
                          key={instance.id}
                          className="flex flex-wrap items-start justify-between gap-3 py-3"
                          data-test="campaign-series-instance"
                        >
                          <div className="min-w-0">
                            <Link
                              href={href}
                              className={`font-medium ${workspaceText} hover:underline`}
                            >
                              {instance.occurrenceKey
                                ? formatOccurrenceLabel(
                                    instance.occurrenceKey,
                                    series.timezone,
                                  )
                                : instance.name}
                            </Link>
                            <p
                              className={`mt-1 truncate text-sm ${workspaceTextMuted}`}
                            >
                              {instance.subject || 'No subject yet'}
                              {instance.scheduledAt
                                ? ` · ${formatZonedInstant(instance.scheduledAt, series.timezone)}`
                                : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <CampaignStatusBadge status={planner} />
                            <CampaignInstanceActions
                              accountId={accountId}
                              accountSlug={accountSlug}
                              seriesId={series.id}
                              campaignId={instance.id}
                              status={instance.status}
                              ready={instance.ready}
                              compact
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className={`flex items-center gap-2 text-xs ${workspaceTextMuted}`}>
        <CalendarClock className="h-3.5 w-3.5" />
        Drafts never send. Mark Ready (or schedule) so the cron can send at the
        occurrence time.
      </p>
    </div>
  );
}
