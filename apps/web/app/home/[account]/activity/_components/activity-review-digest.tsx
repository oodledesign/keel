'use client';

import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { formatDuration } from '~/lib/activity/activity-history';
import type { ActivityAssignmentSummary } from '~/lib/activity/activity-history';
import type { ActivityReportRow } from '~/lib/activity/activity-history';

type Props = {
  assignment: ActivityAssignmentSummary;
  topUnassignedApps: ActivityReportRow[];
  reviewHref: string;
  onSuggest?: () => void;
  suggestPending?: boolean;
};

export function ActivityReviewDigest({
  assignment,
  topUnassignedApps,
  reviewHref,
  onSuggest,
  suggestPending = false,
}: Props) {
  if (assignment.needsReviewCount === 0) {
    return null;
  }

  const unassignedPercent =
    assignment.totalActiveSeconds > 0
      ? Math.round(
          (assignment.unassignedSeconds / assignment.totalActiveSeconds) * 100,
        )
      : 0;

  if (unassignedPercent < 30 && assignment.needsReviewSessionCount < 10) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
            Weekly review
          </p>
          <p className="max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            {formatDuration(assignment.unassignedSeconds)} ({unassignedPercent}
            %) still unassigned across {assignment.needsReviewSessionCount}{' '}
            sessions in this range.
            {topUnassignedApps.length > 0 ? (
              <>
                {' '}
                Top sources:{' '}
                {topUnassignedApps
                  .slice(0, 3)
                  .map(
                    (row) =>
                      `${row.label} (${formatDuration(row.durationSeconds)})`,
                  )
                  .join(', ')}
                .
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSuggest ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
              disabled={suggestPending}
              onClick={onSuggest}
            >
              Suggest assignments
            </Button>
          ) : null}
          <Button asChild size="sm" className="ozer-gradient-btn">
            <Link href={reviewHref}>Review now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
