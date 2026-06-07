'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { formatUsageLabel, formatUsdCost } from '~/lib/rank-tracking/cost';
import type { RankCheckJobRow } from '~/lib/rank-tracking/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function RankCheckJobPoller({
  jobId,
  onComplete,
}: {
  jobId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<RankCheckJobRow | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/rank-check/${jobId}`);
    const json = (await res.json()) as ApiResponse<{ job: RankCheckJobRow }>;
    if (!json.ok) throw new Error(json.error.message);
    setJob(json.data.job);
    return json.data.job;
  }, [jobId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const current = await fetchStatus();
        if (!active) return;

        if (current.status === 'done') {
          toast.success(
            `Rank check complete · ${formatUsdCost(Number(current.api_cost_usd))} API spend`,
          );
          onComplete?.();
          router.refresh();
          return;
        }

        if (current.status === 'error') {
          toast.error(current.error_msg ?? 'Rank check failed');
          return;
        }

        timer = setTimeout(poll, 2500);
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
      <p className="text-muted-foreground text-sm">Starting rank check…</p>
    );
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {job.error_msg ?? 'Rank check failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--keel-teal)]">
        Rank check complete · {formatUsdCost(Number(job.api_cost_usd))} spent
      </p>
    );
  }

  const percent =
    job.tasks_total > 0
      ? Math.round((job.tasks_completed / job.tasks_total) * 100)
      : 10;

  return (
    <div className="max-w-xl space-y-2 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {job.status === 'pending' ? 'Queued…' : 'Checking SERP positions…'}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {formatUsageLabel({
            tasksCompleted: job.tasks_completed,
            tasksTotal: job.tasks_total,
            apiCostUsd: Number(job.api_cost_usd),
          })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-[var(--keel-teal)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
