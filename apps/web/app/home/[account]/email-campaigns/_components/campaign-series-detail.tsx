'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  SERIES_WEEKDAYS,
  formatOccurrenceLabel,
  seriesRecurrenceSummary,
} from '~/lib/campaigns/campaign-recurrence';
import { recurringInstanceStatus } from '~/lib/campaigns/campaign-series-ready';
import {
  CAMPAIGN_TIMEZONES,
  formatZonedInstant,
  timezoneShortLabel,
} from '~/lib/campaigns/campaign-timezone';
import type {
  EmailCampaign,
  EmailCampaignSeries,
} from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { updateCampaignSeriesAction } from '../_lib/server/campaign-series-actions';
import { CampaignInstanceActions } from './campaign-instance-actions';
import { CampaignStatusBadge } from './campaign-status-badge';

type SeriesInstance = {
  id: string;
  name: string;
  subject: string;
  status: EmailCampaign['status'];
  scheduledAt: string | null;
  scheduledTimezone: string;
  ready: boolean;
  occurrenceKey: string | null;
  sentCount: number;
};

export function CampaignSeriesDetail({
  accountId,
  accountSlug,
  series,
  instances,
}: {
  accountId: string;
  accountSlug: string;
  series: EmailCampaignSeries;
  instances: SeriesInstance[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(series.name);
  const [weekday, setWeekday] = useState(series.recurrenceByWeekday ?? 5);
  const [sendHour, setSendHour] = useState(series.sendHour);
  const [sendMinute, setSendMinute] = useState(series.sendMinute);
  const [timezone, setTimezone] = useState(series.timezone);
  const [generateAhead, setGenerateAhead] = useState(series.generateAhead);
  const [subject, setSubject] = useState(series.subject);

  return (
    <div className="space-y-6">
      <div className={`${workspacePanelCard} space-y-4 p-4`}>
        <div>
          <h2 className={`font-semibold ${workspaceText}`}>Series settings</h2>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            {seriesRecurrenceSummary(series)}. New drafts copy this baseline;
            already-created weeks keep their own edits.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-series-name">Name</Label>
            <Input
              id="edit-series-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-series-weekday">Sends on</Label>
            <select
              id="edit-series-weekday"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
            >
              {SERIES_WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-series-hour">Hour</Label>
              <Input
                id="edit-series-hour"
                type="number"
                min={0}
                max={23}
                value={sendHour}
                onChange={(event) => setSendHour(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-series-minute">Minute</Label>
              <Input
                id="edit-series-minute"
                type="number"
                min={0}
                max={59}
                value={sendMinute}
                onChange={(event) => setSendMinute(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-series-timezone">Timezone</Label>
            <select
              id="edit-series-timezone"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {CAMPAIGN_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {timezoneShortLabel(zone)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-series-ahead">Generate ahead</Label>
            <Input
              id="edit-series-ahead"
              type="number"
              min={1}
              max={12}
              value={generateAhead}
              onChange={(event) => setGenerateAhead(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-series-subject">Baseline subject</Label>
            <Input
              id="edit-series-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className={workspaceBtnPrimary}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await updateCampaignSeriesAction({
                    accountId,
                    accountSlug,
                    seriesId: series.id,
                    name,
                    timezone,
                    recurrenceByWeekday: weekday,
                    sendHour,
                    sendMinute,
                    generateAhead,
                    subject,
                  });
                  toast.success('Series updated');
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not update series',
                  );
                }
              });
            }}
          >
            Save series
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await updateCampaignSeriesAction({
                    accountId,
                    accountSlug,
                    seriesId: series.id,
                    status: series.status === 'paused' ? 'active' : 'paused',
                  });
                  toast.success(
                    series.status === 'paused'
                      ? 'Series resumed'
                      : 'Series paused — no new drafts',
                  );
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not update series',
                  );
                }
              });
            }}
          >
            {series.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>

      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>Upcoming instances</h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Draft → Ready → Scheduled/Sent. A week that is not Ready will never
          send.
        </p>
        {instances.length === 0 ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            No instances yet. They appear after the next generate pass.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {instances.map((instance) => {
              const href = pathsConfig.app.accountEmailCampaignContent
                .replace('[account]', accountSlug)
                .replace('[campaignId]', instance.id);
              const planner = recurringInstanceStatus(instance);
              return (
                <li
                  key={instance.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                  data-test="series-instance-row"
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
                    <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
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
      </div>
    </div>
  );
}
