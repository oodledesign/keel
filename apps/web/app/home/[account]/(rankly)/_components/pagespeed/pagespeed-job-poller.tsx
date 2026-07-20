'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { PagespeedCheckJobRow } from '~/lib/pagespeed/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function PagespeedJobPoller({
  jobId,
  onComplete,
}: {
  jobId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<PagespeedCheckJobRow | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/pagespeed/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: PagespeedCheckJobRow;
    }>;
    if (!json.ok) throw new Error(json.error.message);
    setJob(json.data.job);
    return json.data.job;
  }, [jobId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let lastTasksCompleted = -1;

    const poll = async () => {
      try {
        const current = await fetchStatus();
        if (!active) return;

        if (current.status === 'done') {
          toast.success('PageSpeed check complete');
          onComplete?.();
          router.refresh();
          return;
        }

        if (current.status === 'error') {
          toast.error(current.error_msg ?? 'PageSpeed check failed');
          router.refresh();
          return;
        }

        if (
          current.tasks_completed > 0 &&
          current.tasks_completed !== lastTasksCompleted
        ) {
          lastTasksCompleted = current.tasks_completed;
          router.refresh();
        }

        timer = setTimeout(poll, 3000);
      } catch (err) {
        if (active) toast.error(getErrorMessage(err));
      }
    };

    void poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchStatus, jobId, onComplete, router]);

  if (!job) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Starting PageSpeed check…
      </p>
    );
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_12%,transparent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
        {job.error_msg ?? 'PageSpeed check failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--ozer-accent)]">
        PageSpeed check complete
      </p>
    );
  }

  const percent =
    job.tasks_total > 0
      ? Math.round((job.tasks_completed / job.tasks_total) * 100)
      : 10;

  return (
    <div className="max-w-xl space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--workspace-shell-text-muted)]">
          {job.status === 'pending' ? 'Queued…' : 'Running PageSpeed Insights…'}
        </span>
        <span className="text-[var(--workspace-shell-text-muted)] tabular-nums">
          {job.tasks_completed}/{job.tasks_total} checks
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
        <div
          className="h-full rounded-full bg-[var(--ozer-accent)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
