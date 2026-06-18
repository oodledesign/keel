'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { AUDIT_STATUS_LABELS } from '~/lib/ai-audit/types';

import { RanklyJobProgress } from '../rankly-job-progress';
import { useRanklyJobProgress } from '../../_lib/use-rankly-job-progress';

type AuditJob = {
  id: string;
  status: string;
  error_msg: string | null;
  pages_crawled: number | null;
  credits_used: number | null;
  reportId?: string | null;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

const PROGRESS = [
  'pending',
  'crawling',
  'extracting',
  'checking_citations',
  'scoring',
  'done',
] as const;

function progressPercent(status: string): number {
  const index = PROGRESS.indexOf(status as (typeof PROGRESS)[number]);
  if (index < 0) return 5;
  return Math.round((index / (PROGRESS.length - 1)) * 100);
}

export function AuditJobPoller({
  jobId,
  auditPath,
}: {
  jobId: string;
  auditPath: string;
}) {
  const router = useRouter();

  const fallbackFetch = useCallback(async () => {
    const res = await fetch(`/api/rankly/ai-audit/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: AuditJob;
      reportId: string | null;
    }>;
    if (!json.ok) {
      throw new Error(json.error.message);
    }
    return {
      ...json.data.job,
      reportId: json.data.reportId,
    };
  }, [jobId]);

  const { data: job } = useRanklyJobProgress({
    streamUrl: `/api/rankly/ai-audit/${jobId}/stream`,
    fallbackFetch,
    isTerminal: (data) => data.status === 'done' || data.status === 'error',
  });

  useEffect(() => {
    if (job?.status === 'done' && job.reportId) {
      router.push(`${auditPath}/${job.reportId}`);
      router.refresh();
    }
  }, [auditPath, job, router]);

  if (!job) {
    return <p className="text-sm text-muted-foreground">Loading audit status…</p>;
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {job.error_msg ?? 'Audit failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return <p className="text-sm text-emerald-400">Audit complete — redirecting…</p>;
  }

  const label = AUDIT_STATUS_LABELS[job.status] ?? job.status;
  const meta =
    job.pages_crawled != null
      ? `${job.pages_crawled} pages crawled · ~${job.credits_used ?? 25} DataForSEO credits`
      : `~${job.credits_used ?? 25} DataForSEO credits`;

  return (
    <RanklyJobProgress
      label={label}
      percent={progressPercent(job.status)}
      meta={meta}
    />
  );
}
