'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { formatUsageLabel, formatUsdCost } from '~/lib/rank-tracking/cost';
import { RANK_JOB_POLL_INTERVAL_MS } from '~/lib/rank-tracking/queue-config';
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
  const [cancelling, setCancelling] = useState(false);
  const terminalNotifiedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/rank-check/${jobId}`);
    const json = (await res.json()) as ApiResponse<{ job: RankCheckJobRow }>;
    if (!json.ok) throw new Error(json.error.message);
    setJob(json.data.job);
    return json.data.job;
  }, [jobId]);

  const cancelJob = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/rankly/rank-check/${jobId}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as ApiResponse<{ job: RankCheckJobRow }>;
      if (!json.ok) throw new Error(json.error.message);

      setJob(json.data.job);
      if (!terminalNotifiedRef.current) {
        terminalNotifiedRef.current = true;
        toast.message('Rank check cancelled');
        onComplete?.();
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const notifyTerminal = (
      type: 'done' | 'error' | 'cancelled',
      message: string,
    ) => {
      if (terminalNotifiedRef.current) return;
      terminalNotifiedRef.current = true;
      if (type === 'done') {
        toast.success(message);
      } else if (type === 'cancelled') {
        toast.message(message);
      } else {
        toast.error(message);
      }
      onComplete?.();
    };

    const poll = async () => {
      try {
        const current = await fetchStatus();
        if (!active) return;

        if (current.status === 'done') {
          notifyTerminal(
            'done',
            `Rank check complete · ${formatUsdCost(Number(current.api_cost_usd))} API spend`,
          );
          router.refresh();
          return;
        }

        if (current.status === 'error') {
          if (current.error_msg === 'Cancelled by user') {
            notifyTerminal('cancelled', 'Rank check cancelled');
          } else {
            notifyTerminal('error', current.error_msg ?? 'Rank check failed');
          }
          router.refresh();
          return;
        }

        timer = setTimeout(poll, RANK_JOB_POLL_INTERVAL_MS);
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
      <div className="max-w-xl space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-muted-foreground text-sm">Starting rank check…</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cancelling}
          onClick={() => void cancelJob()}
        >
          {cancelling ? 'Cancelling…' : 'Cancel check'}
        </Button>
      </div>
    );
  }

  if (job.status === 'error') {
    const cancelled = job.error_msg === 'Cancelled by user';
    return (
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          cancelled
            ? 'text-muted-foreground border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]'
            : 'border-red-500/30 bg-red-500/10 text-red-200'
        }`}
      >
        {job.error_msg ?? 'Rank check failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--ozer-accent)]">
        Rank check complete · {formatUsdCost(Number(job.api_cost_usd))} spent
      </p>
    );
  }

  const percent =
    job.tasks_total > 0
      ? Math.round((job.tasks_completed / job.tasks_total) * 100)
      : 10;

  return (
    <div className="max-w-xl space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
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
          className="h-full rounded-full bg-[var(--ozer-accent)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cancelling}
          onClick={() => void cancelJob()}
        >
          {cancelling ? 'Cancelling…' : 'Cancel check'}
        </Button>
      </div>
    </div>
  );
}
