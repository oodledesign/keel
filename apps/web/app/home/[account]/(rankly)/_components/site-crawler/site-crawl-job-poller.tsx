'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { SITE_CRAWL_POLL_INTERVAL_MS } from '~/lib/site-crawl/config';
import type { SiteCrawlJobRow } from '~/lib/site-crawl/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function SiteCrawlJobPoller({
  jobId,
  onComplete,
}: {
  jobId: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<SiteCrawlJobRow | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/rankly/site-crawl/${jobId}`);
    const json = (await res.json()) as ApiResponse<{ job: SiteCrawlJobRow }>;
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
            `Site crawl complete · ${current.urls_crawled.toLocaleString()} pages analysed`,
          );
          onComplete?.();
          router.refresh();
          return;
        }

        if (current.status === 'error') {
          toast.error(current.error_msg ?? 'Site crawl failed');
          router.refresh();
          return;
        }

        timer = setTimeout(poll, SITE_CRAWL_POLL_INTERVAL_MS);
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
        Starting site crawl…
      </p>
    );
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent-pressed,#C2452A)_12%,transparent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
        {job.error_msg ?? 'Site crawl failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--ozer-accent)]">
        Crawl complete · {job.urls_crawled.toLocaleString()} pages
      </p>
    );
  }

  const total = Math.max(job.url_limit, job.urls_discovered, 1);
  const percent = Math.min(100, Math.round((job.urls_crawled / total) * 100));

  return (
    <div className="max-w-xl space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--workspace-shell-text-muted)]">
          {job.status === 'pending' ? 'Queued…' : 'Crawling internal links…'}
        </span>
        <span className="text-[var(--workspace-shell-text-muted)] tabular-nums">
          {job.urls_crawled.toLocaleString()} / {job.url_limit.toLocaleString()}{' '}
          pages
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
