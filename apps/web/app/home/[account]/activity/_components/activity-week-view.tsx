'use client';

import { useMemo } from 'react';

import { cn } from '@kit/ui/utils';

import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import {
  type ActivityBlockListRow,
  aggregateActivityByApp,
  aggregateActivityByClient,
  aggregateActivityByProject,
  formatDuration,
  sumActiveDuration,
  summarizeActivityWeekDays,
} from '~/lib/activity/activity-history';

import { ActivitySummaryBreakdown } from './activity-summary-breakdown';

type Props = {
  data: ActivityPageData;
  blocks: ActivityBlockListRow[];
  focusDate: string;
  onSelectDay: (dayKey: string) => void;
};

export function ActivityWeekView({
  data,
  blocks,
  focusDate,
  onSelectDay,
}: Props) {
  const activeBlocks = useMemo(
    () => blocks.filter((block) => !block.isExcluded),
    [blocks],
  );
  const weekTotal = useMemo(
    () => sumActiveDuration(activeBlocks),
    [activeBlocks],
  );
  const weekDays = useMemo(
    () => summarizeActivityWeekDays(activeBlocks, focusDate),
    [activeBlocks, focusDate],
  );
  const topApps = useMemo(
    () => aggregateActivityByApp(activeBlocks),
    [activeBlocks],
  );
  const topClients = useMemo(
    () => aggregateActivityByClient(activeBlocks),
    [activeBlocks],
  );
  const topProjects = useMemo(
    () => aggregateActivityByProject(activeBlocks),
    [activeBlocks],
  );
  const maxDayDuration = useMemo(
    () => Math.max(...weekDays.map((day) => day.durationSeconds), 0),
    [weekDays],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Week overview
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--workspace-shell-text)]">
              {formatDuration(weekTotal)}
            </p>
          </div>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {data.dateFrom} – {data.dateTo}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-7">
          {weekDays.map((day) => {
            const barHeight =
              maxDayDuration > 0
                ? Math.max(12, (day.durationSeconds / maxDayDuration) * 100)
                : 0;

            return (
              <button
                key={day.dayKey}
                type="button"
                className={cn(
                  'group flex flex-col rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/20 px-2 py-3 text-left transition-colors hover:bg-[var(--workspace-control-surface)]/50',
                  day.isToday &&
                    'border-[color:var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]/20',
                )}
                onClick={() => onSelectDay(day.dayKey)}
              >
                <span className="text-[10px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  {day.shortLabel}
                </span>
                <span className="mt-1 text-xs font-semibold text-[var(--workspace-shell-text)]">
                  {day.label.split(' ').slice(1).join(' ')}
                </span>
                <div className="mt-3 flex flex-1 items-end">
                  <div className="h-16 w-full overflow-hidden rounded-md bg-[var(--workspace-control-surface)]">
                    <div
                      className="w-full rounded-md bg-[var(--ozer-accent)] transition-all group-hover:bg-[var(--ozer-accent-hover)]"
                      style={{
                        height: `${barHeight}%`,
                        marginTop: `${100 - barHeight}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="mt-2 text-xs font-medium text-[var(--workspace-shell-text)]">
                  {formatDuration(day.durationSeconds)}
                </span>
                <span className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                  {day.sessionCount} session{day.sessionCount === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <ActivitySummaryBreakdown
            title="Most used apps"
            rows={topApps}
            emptyLabel="No app activity this week"
            maxRows={8}
          />
        </div>
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <ActivitySummaryBreakdown
            title="Top clients"
            rows={topClients}
            emptyLabel="No client time this week"
            maxRows={8}
            accentClassName="bg-sky-500"
            showClientAvatars
          />
        </div>
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <ActivitySummaryBreakdown
            title="Top projects"
            rows={topProjects}
            emptyLabel="No project time this week"
            maxRows={8}
            accentClassName="bg-violet-500"
          />
        </div>
      </div>

      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Select a day above to open the detailed day view with your activity
        timeline and memory feed.
      </p>
    </div>
  );
}
