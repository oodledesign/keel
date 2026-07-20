'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type ClusterJob = {
  id: string;
  status: string;
  error_msg: string | null;
  credits_used: number | null;
  candidate_count: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Starting…',
  expanding: 'Expanding seed keywords…',
  awaiting_confirmation: 'Ready for SERP fetch',
  fetching_serps: 'Fetching SERPs…',
  clustering: 'Clustering by SERP overlap…',
  saving: 'Saving plan…',
  done: 'Complete',
  error: 'Failed',
};

const PROGRESS_STEPS = [
  'pending',
  'expanding',
  'awaiting_confirmation',
  'fetching_serps',
  'clustering',
  'saving',
  'done',
] as const;

function progressPercent(status: string): number {
  const index = PROGRESS_STEPS.indexOf(
    status as (typeof PROGRESS_STEPS)[number],
  );
  if (index < 0) return status === 'error' ? 0 : 10;
  return Math.round((index / (PROGRESS_STEPS.length - 1)) * 100);
}

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function ClusterJobPoller({
  jobId,
  onComplete,
}: {
  jobId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<ClusterJob | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/clusters/${jobId}`);
    const json = (await res.json()) as ApiResponse<{ job: ClusterJob }>;
    if (!json.ok) {
      throw new Error(json.error.message);
    }
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
          onComplete?.();
          router.refresh();
          return;
        }

        if (current.status === 'error') {
          return;
        }

        if (current.status !== 'awaiting_confirmation') {
          timer = setTimeout(poll, 3000);
        }
      } catch (err) {
        if (active) {
          toast.error(getErrorMessage(err));
        }
      }
    };

    void poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchStatus, jobId, onComplete, router]);

  const confirmSerpFetch = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/rankly/clusters/${jobId}`, {
        method: 'POST',
      });
      const json = (await res.json()) as ApiResponse<{ ok: boolean }>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }
      toast.success('Fetching SERPs…');
      setJob((prev) => (prev ? { ...prev, status: 'fetching_serps' } : prev));
      // resume polling
      const poll = async () => {
        const current = await fetchStatus();
        if (current.status === 'done') {
          router.refresh();
          return;
        }
        if (current.status === 'error') return;
        if (current.status !== 'awaiting_confirmation') {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 3000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  if (!job) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading job status…
      </p>
    );
  }

  const percent = progressPercent(job.status);
  const label = STATUS_LABELS[job.status] ?? job.status;

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_12%,transparent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
        {job.error_msg ?? 'Cluster job failed'}
      </div>
    );
  }

  if (job.status === 'awaiting_confirmation') {
    const credits = job.credits_used ?? 0;
    const count = job.candidate_count ?? 0;

    return (
      <div className="max-w-xl space-y-4 rounded-lg border border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] px-4 py-4">
        <p className="text-sm text-[var(--workspace-shell-text)]">
          Found <strong>{count}</strong> candidate keywords after filtering.
          Fetching SERPs will use approximately <strong>{credits}</strong>{' '}
          DataForSEO credits.
        </p>
        {credits > 500 ? (
          <p className="text-xs text-[var(--workspace-shell-text)]/80">
            This is a large run. Consider raising minimum volume to reduce
            candidates.
          </p>
        ) : null}
        <Button onClick={confirmSerpFetch} disabled={confirming}>
          {confirming ? 'Starting…' : 'Continue with SERP fetch'}
        </Button>
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--ozer-accent)]">Cluster plan ready.</p>
    );
  }

  return (
    <div className="max-w-xl space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--workspace-shell-text-muted)]">
          {label}
        </span>
        <span className="text-[var(--workspace-shell-text-muted)]">
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
