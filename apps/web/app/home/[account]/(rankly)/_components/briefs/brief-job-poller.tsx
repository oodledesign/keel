'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { BRIEF_STATUS_LABELS } from '~/lib/briefs/types';

import { RanklyJobProgress } from '../rankly-job-progress';
import { useRanklyJobProgress } from '../../_lib/use-rankly-job-progress';

type BriefJob = {
  id: string;
  status: string;
  error_msg: string | null;
  target_keyword: string | null;
  credits_used: number | null;
  briefId?: string | null;
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

  const fallbackFetch = useCallback(async () => {
    const res = await fetch(`/api/rankly/briefs/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: BriefJob;
      briefId: string | null;
    }>;
    if (!json.ok) {
      throw new Error(json.error.message);
    }
    return {
      ...json.data.job,
      briefId: json.data.briefId,
    };
  }, [jobId]);

  const { data: job } = useRanklyJobProgress({
    streamUrl: `/api/rankly/briefs/${jobId}/stream`,
    fallbackFetch,
    isTerminal: (data) => data.status === 'done' || data.status === 'error',
  });

  useEffect(() => {
    if (job?.status === 'done' && job.briefId) {
      router.push(`${briefsPath}/${job.briefId}`);
      router.refresh();
    }
  }, [briefsPath, job, router]);

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
  const detail = job.target_keyword
    ? `Keyword: ${job.target_keyword}`
    : null;
  const meta =
    job.credits_used != null ? `~${job.credits_used} credits` : null;

  return (
    <RanklyJobProgress
      label={label}
      percent={progressPercent(job.status)}
      detail={detail}
      meta={meta}
    />
  );
}
