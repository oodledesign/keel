'use client';

import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { cn } from '@kit/ui/utils';

import type { ActivityLayoutMode } from '~/lib/activity/activity-history';
import {
  formatActivityFocusDateLabel,
  formatDuration,
} from '~/lib/activity/activity-history';

type ActivityLayoutNavProps = {
  layoutMode: ActivityLayoutMode;
  focusDate: string;
  dateFrom: string;
  dateTo: string;
  totalDurationSeconds: number;
  isPending?: boolean;
  onLayoutChange: (layout: ActivityLayoutMode) => void;
  onFocusDateChange: (date: string) => void;
  onShiftFocusDate: (deltaDays: number) => void;
};

function weekRangeLabel(dateFrom: string, dateTo: string): string {
  const from = parseISO(`${dateFrom}T12:00:00`);
  const to = parseISO(`${dateTo}T12:00:00`);

  if (format(from, 'MMM yyyy') === format(to, 'MMM yyyy')) {
    return `${format(from, 'd')} – ${format(to, 'd MMMM yyyy')}`;
  }

  return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
}

export function ActivityLayoutNav({
  layoutMode,
  focusDate,
  dateFrom,
  dateTo,
  totalDurationSeconds,
  isPending = false,
  onLayoutChange,
  onFocusDateChange,
  onShiftFocusDate,
}: ActivityLayoutNavProps) {
  const dateLabel =
    layoutMode === 'week'
      ? weekRangeLabel(dateFrom, dateTo)
      : formatActivityFocusDateLabel(focusDate);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5',
        isPending && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={layoutMode}
          onValueChange={(value) => onLayoutChange(value as ActivityLayoutMode)}
        >
          <TabsList className="h-9 bg-[var(--workspace-control-surface)]">
            <TabsTrigger value="day" className="px-3 text-xs">
              Day
            </TabsTrigger>
            <TabsTrigger value="week" className="px-3 text-xs">
              Week
            </TabsTrigger>
            <TabsTrigger value="list" className="px-3 text-xs">
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {layoutMode !== 'list' ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onShiftFocusDate(layoutMode === 'week' ? -7 : -1)}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="min-w-[10rem] rounded-md px-2 py-1 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-control-surface)]"
              onClick={() =>
                onFocusDateChange(format(new Date(), 'yyyy-MM-dd'))
              }
              title="Jump to today"
            >
              {dateLabel}
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onShiftFocusDate(layoutMode === 'week' ? 7 : 1)}
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--workspace-shell-text-muted)]">
          {layoutMode === 'day' ? 'Day total' : 'Period total'}
        </span>
        <span className="font-semibold text-[var(--workspace-shell-text)]">
          {formatDuration(totalDurationSeconds)}
        </span>
      </div>
    </div>
  );
}
