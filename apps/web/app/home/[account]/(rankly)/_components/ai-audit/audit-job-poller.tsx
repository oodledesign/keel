'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import { AUDIT_STATUS_LABELS } from '~/lib/ai-audit/types';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type AuditJob = {
  id: string;
  status: string;
  error_msg: string | null;
  pages_crawled: number | null;
  credits_used: number | null;
};

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

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function AuditJobPoller({
  jobId,
  auditPath,
}: {
  jobId: string;
  auditPath: string;
}) {
  const router = useRouter();
  const [job, setJob] = useState<AuditJob | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/rankly/ai-audit/${jobId}`);
    const json = (await res.json()) as ApiResponse<{
      job: AuditJob;
      reportId: string | null;
    }>;
    if (!json.ok) throw new Error(json.error.message);
    setJob(json.data.job);
    if (json.data.job.status === 'done' && json.data.reportId) {
      router.push(`${auditPath}/${json.data.reportId}`);
      router.refresh();
    }
    return json.data.job;
  }, [auditPath, jobId, router]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      try {
        const current = await poll();
        if (!active) return;
        if (current.status === 'done' || current.status === 'error') return;
        timer = setTimeout(run, 3000);
      } catch (err) {
        if (active) toast.error(getErrorMessage(err));
      }
    };

    void run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [poll]);

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

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground">
        {job.pages_crawled != null ? `${job.pages_crawled} pages crawled · ` : ''}
        ~{job.credits_used ?? 25} DataForSEO credits
      </p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{progressPercent(job.status)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent(job.status)}%` }}
        />
      </div>
    </div>
  );
}
