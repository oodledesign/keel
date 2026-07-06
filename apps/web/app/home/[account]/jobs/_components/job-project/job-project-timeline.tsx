'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { updatePhase } from '../../_lib/server/server-actions';
import { getErrorMessage } from '../../_lib/error-message';
import type { JobBoardResult, PhaseListItem } from '../../_lib/schema/project-phases.schema';
import {
  PHASE_STATUS_LABELS,
  formatShortDate,
  parseDateKey,
} from './job-project.constants';

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(d: Date) {
  const next = new Date(d);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(12, 0, 0, 0);
  return next;
}

function dateToInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function phasePath(accountSlug: string, jobId: string, phaseId: string) {
  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId)
    .replace('[phaseId]', phaseId);
}

type ResolvedPhase = PhaseListItem & {
  start: Date;
  end: Date;
};

function resolvePhaseDates(
  phases: PhaseListItem[],
  jobStart: string | null,
): ResolvedPhase[] {
  let cursor =
    parseDateKey(jobStart) ?? startOfWeek(new Date());

  return phases.map((phase) => {
    const start = parseDateKey(phase.start_date) ?? new Date(cursor);
    const end =
      parseDateKey(phase.due_date) ??
      addDays(start, phase.is_milestone ? 0 : 6);
    const resolvedEnd = end.getTime() < start.getTime() ? start : end;
    cursor = addDays(resolvedEnd, 1);
    return { ...phase, start, end: resolvedEnd };
  });
}

function PhaseBar({
  phase,
  rangeStart,
  rangeEnd,
  accountSlug,
  jobId,
  canEditJobs,
  onDatesChange,
}: {
  phase: ResolvedPhase;
  rangeStart: Date;
  rangeEnd: Date;
  accountSlug: string;
  jobId: string;
  canEditJobs: boolean;
  onDatesChange: (phaseId: string, start: Date, end: Date) => void;
}) {
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  const leftPct =
    ((phase.start.getTime() - rangeStart.getTime()) / rangeMs) * 100;
  const widthPct =
    Math.max(
      phase.is_milestone ? 1.5 : 4,
      ((phase.end.getTime() - phase.start.getTime()) / rangeMs) * 100,
    );

  const dragRef = useRef<'start' | 'end' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = (edge: 'start' | 'end') => (e: React.PointerEvent) => {
    if (!canEditJobs) return;
    e.preventDefault();
    dragRef.current = edge;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !canEditJobs) return;
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ms = rangeStart.getTime() + pct * rangeMs;
    const snapped = startOfWeek(new Date(ms));

    if (dragRef.current === 'start') {
      const end = phase.end.getTime() < snapped.getTime() ? snapped : phase.end;
      onDatesChange(phase.id, snapped, end);
    } else {
      const start =
        snapped.getTime() < phase.start.getTime() ? phase.start : snapped;
      onDatesChange(phase.id, phase.start, start);
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const colour = phase.colour ?? '#FF5C34';

  if (phase.is_milestone) {
    return (
      <div className="relative h-10" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <Link
          href={phasePath(accountSlug, jobId, phase.id)}
          prefetch={false}
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${leftPct}%` }}
          title={phase.name}
        >
          <span
            className="block h-4 w-4 rotate-45 border-2 border-[color:var(--workspace-shell-border)]"
            style={{ backgroundColor: colour }}
          />
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-10 py-1" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div
        className="absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-md border border-[color:var(--workspace-shell-border)]"
        style={{
          left: `${Math.max(0, leftPct)}%`,
          width: `${Math.min(100 - leftPct, widthPct)}%`,
          backgroundColor: `${colour}33`,
        }}
      >
        <div
          className="h-full opacity-90"
          style={{
            width: `${phase.progressPct}%`,
            backgroundColor: colour,
          }}
        />
        {canEditJobs && (
          <>
            <button
              type="button"
              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
              onPointerDown={onPointerDown('start')}
              aria-label="Adjust start date"
            />
            <button
              type="button"
              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
              onPointerDown={onPointerDown('end')}
              aria-label="Adjust end date"
            />
          </>
        )}
      </div>
      <Link
        href={phasePath(accountSlug, jobId, phase.id)}
        prefetch={false}
        className="absolute top-full mt-1 truncate text-[11px] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        style={{
          left: `${Math.max(0, leftPct)}%`,
          maxWidth: `${Math.min(100 - leftPct, widthPct)}%`,
        }}
      >
        {phase.name}
        {isDragging ? '' : ` · ${PHASE_STATUS_LABELS[phase.status]}`}
      </Link>
    </div>
  );
}

export function JobProjectTimeline({
  accountSlug,
  accountId,
  jobId,
  board,
  canEditJobs,
  onBoardChange,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  board: JobBoardResult;
  canEditJobs: boolean;
  onBoardChange: (board: JobBoardResult) => void;
}) {
  const [, startTransition] = useTransition();
  const jobStart = (board.job.start_date as string | null) ?? null;

  const resolved = useMemo(
    () => resolvePhaseDates(board.phases, jobStart),
    [board.phases, jobStart],
  );

  const { rangeStart, rangeEnd, weeks } = useMemo(() => {
    const today = startOfWeek(new Date());
    let min = today;
    let max = addDays(today, 7 * 8);

    for (const p of resolved) {
      if (p.start < min) min = startOfWeek(p.start);
      if (p.end > max) max = addDays(startOfWeek(p.end), 7);
    }

    const weekLabels: Date[] = [];
    let cursor = new Date(min);
    while (cursor <= max) {
      weekLabels.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }

    return { rangeStart: min, rangeEnd: max, weeks: weekLabels };
  }, [resolved]);

  const handleDatesChange = useCallback(
    (phaseId: string, start: Date, end: Date) => {
      const nextPhases = board.phases.map((p) =>
        p.id === phaseId
          ? {
              ...p,
              start_date: dateToInput(start),
              due_date: dateToInput(end),
            }
          : p,
      );
      onBoardChange({ ...board, phases: nextPhases });

      startTransition(async () => {
        try {
          await updatePhase({
            accountId,
            accountSlug,
            jobId,
            phaseId,
            start_date: start,
            due_date: end,
          });
        } catch (err) {
          toast.error(getErrorMessage(err));
          onBoardChange(board);
        }
      });
    },
    [accountId, accountSlug, board, jobId, onBoardChange, startTransition],
  );

  if (board.phases.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Add phases to see them on the timeline.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/20">
      <div className="min-w-[640px] p-4">
        <div className="mb-4 flex border-b border-[color:var(--workspace-shell-border)] pb-2">
          {weeks.map((w) => (
            <div
              key={w.toISOString()}
              className="flex-1 min-w-[72px] text-[10px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]"
            >
              {formatShortDate(dateToInput(w))}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {resolved.map((phase) => (
            <div key={phase.id} className="grid grid-cols-[140px_1fr] gap-3 items-start">
              <div className="pt-1">
                <Link
                  href={phasePath(accountSlug, jobId, phase.id)}
                  prefetch={false}
                  className="text-sm font-medium text-[var(--workspace-shell-text)] hover:underline"
                >
                  {phase.name}
                </Link>
                <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                  {formatShortDate(phase.start_date)} – {formatShortDate(phase.due_date)}
                </p>
                <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">{phase.progressPct}% complete</p>
              </div>
              <div className="relative rounded-lg bg-[var(--workspace-control-surface)]/30 px-1">
                <PhaseBar
                  phase={phase}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  accountSlug={accountSlug}
                  jobId={jobId}
                  canEditJobs={canEditJobs}
                  onDatesChange={handleDatesChange}
                />
              </div>
            </div>
          ))}
        </div>

        {!canEditJobs && (
          <p className="mt-4 text-xs text-[var(--workspace-shell-text-muted)]">
            Timeline dates are read-only — you need jobs edit permission to adjust.
          </p>
        )}
      </div>
    </div>
  );
}
