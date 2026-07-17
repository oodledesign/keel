'use client';

import { cn } from '@kit/ui/utils';

import type { ActivityReportRow } from '~/lib/activity/activity-history';
import { formatDuration } from '~/lib/activity/activity-history';

type ActivitySummaryBreakdownProps = {
  title: string;
  rows: ActivityReportRow[];
  emptyLabel: string;
  maxRows?: number;
  accentClassName?: string;
  onRowClick?: (row: ActivityReportRow) => void;
};

export function ActivitySummaryBreakdown({
  title,
  rows,
  emptyLabel,
  maxRows = 5,
  accentClassName = 'bg-[var(--ozer-accent)]',
  onRowClick,
}: ActivitySummaryBreakdownProps) {
  const visibleRows = rows.slice(0, maxRows);
  const maxDuration = visibleRows[0]?.durationSeconds ?? 0;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {title}
      </h3>
      {visibleRows.length === 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => {
            const widthPercent =
              maxDuration > 0
                ? Math.max(8, (row.durationSeconds / maxDuration) * 100)
                : 0;

            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-lg px-1 py-1 text-left transition-colors',
                    onRowClick &&
                      'hover:bg-[var(--workspace-control-surface)]/60',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  disabled={!onRowClick}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-xs font-medium text-[var(--workspace-shell-text)]"
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                      {formatDuration(row.durationSeconds)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
                    <div
                      className={cn('h-full rounded-full', accentClassName)}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
