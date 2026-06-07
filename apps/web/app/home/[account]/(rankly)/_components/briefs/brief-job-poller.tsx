'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import { BRIEF_STATUS_LABELS } from '~/lib/briefs/types';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type BriefJob = {
  id: string;
  status: string;
  error_msg: string | null;
  target_keyword: string | null;
  credits_used: number | null;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

const PROGRESS_STATUSES = [
  'pending',
  'domain_overview',
  'competitor_discovery',
  'keyword_gap',
  'serp_analysis',
  'scraping_competitors',
  'classifying',
  'internal_links',
  'synthesising',
  'done',
] as const;

function progressPercent(status: string): number {
  const index = PROGRESS_STATUSES.indexOf(
    status as (typeof PROGRESS_STATUSES)[number],
  );
  if (index < 0) return status === 'error' ? 0 : 5;
  return Math.round((index / (PROGRESS_STATUSES.length - 1)) * 100);
}

export function BriefJobPoller({
  jobId,
  briefsPath,
}: {
  jobId: string;
  briefsPath: string;
}) {
  const router = useRouter();
  const [job, setJob] = useState<BriefJob | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/briefs/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: BriefJob;
      briefId: string | null;
    }>;
    if (!json.ok) {
      throw new Error(json.error.message);
    }
    setJob(json.data.job);

    if (json.data.job.status === 'done' && json.data.briefId) {
      router.push(`${briefsPath}/${json.data.briefId}`);
      router.refresh();
    }

    return json.data;
  }, [briefsPath, jobId, router]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await fetchStatus();
        if (!active) return;
        if (data.job.status === 'done' || data.job.status === 'error') return;
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
  }, [fetchStatus]);

  if (!job) {
    return <p className="text-sm text-muted-foreground">Loading job status…</p>;
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {job.error_msg ?? 'Brief generation failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-emerald-400">Brief ready — redirecting…</p>
    );
  }

  const label = BRIEF_STATUS_LABELS[job.status] ?? job.status;
  const percent = progressPercent(job.status);

  return (
    <div className="max-w-xl space-y-3">
      {job.target_keyword ? (
        <p className="text-sm text-muted-foreground">
          Keyword: <span className="text-foreground">{job.target_keyword}</span>
          {job.credits_used != null ? ` · ~${job.credits_used} credits` : ''}
        </p>
      ) : null}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
