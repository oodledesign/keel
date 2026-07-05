'use client';

import type { JobBoardResult } from '../../_lib/schema/project-phases.schema';

export function JobProjectHeader({
  board,
}: {
  board: Pick<JobBoardResult, 'progressPct'> | null;
}) {
  const progressPct = board?.progressPct ?? 0;

  return (
    <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] pb-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--workspace-shell-text-muted)]">
        <span>Progress</span>
        <span className="tabular-nums text-[var(--workspace-shell-text-muted)]">
          {progressPct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
        <div
          className="h-full rounded-full bg-[var(--ozer-accent)] transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
    </div>
  );
}
