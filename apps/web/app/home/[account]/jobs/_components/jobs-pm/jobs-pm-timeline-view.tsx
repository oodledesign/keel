'use client';

import Link from 'next/link';

import { formatTimelineRange, getProjectGroupId, PHASE_CELL } from './jobs-pm.constants';
import type { JobsPmRow } from './jobs-pm-main-table';

export function JobsPmTimelineView({
  jobs,
  jobDetailPath,
}: {
  jobs: JobsPmRow[];
  jobDetailPath: string;
}) {
  const sorted = [...jobs].sort((a, b) => {
    const aDate = a.due_date ?? a.start_date ?? '';
    const bDate = b.due_date ?? b.start_date ?? '';
    return aDate.localeCompare(bDate);
  });

  const withDates = sorted.filter((j) => j.start_date || j.due_date);
  const undated = sorted.filter((j) => !j.start_date && !j.due_date);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
      <p className="mb-4 text-sm text-zinc-400">
        Timeline view of all projects by schedule. Open a project for the full
        phase board and Gantt.
      </p>

      <div className="space-y-2">
        {withDates.map((job) => {
          const phase = PHASE_CELL[getProjectGroupId(job.status)];
          return (
            <Link
              key={job.id}
              href={jobDetailPath.replace('[id]', job.id)}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-[var(--workspace-shell-panel)]/60 px-4 py-3 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
            >
              <span
                className="h-10 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: phase.bg }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{job.title}</p>
                <p className="text-xs text-zinc-500">
                  {job.clients?.display_name ?? 'No client'}
                </p>
              </div>
              <span
                className="rounded px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: phase.bg, color: phase.text }}
              >
                {phase.label}
              </span>
              <span className="rounded-md bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300">
                {formatTimelineRange(job.start_date, job.due_date)}
              </span>
            </Link>
          );
        })}

        {undated.length > 0 && (
          <div className="pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              No dates set
            </p>
            <div className="space-y-2">
              {undated.map((job) => (
                <Link
                  key={job.id}
                  href={jobDetailPath.replace('[id]', job.id)}
                  className="block rounded-lg border border-dashed border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:border-white/20 hover:text-white"
                >
                  {job.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
