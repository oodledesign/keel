'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
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
    let lastCrawled = -1;

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

        if (
          current.urls_crawled > 0 &&
          current.urls_crawled !== lastCrawled
        ) {
          lastCrawled = current.urls_crawled;
          router.refresh();
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
      <p className="text-muted-foreground text-sm">Starting site crawl…</p>
    );
  }

  if (job.status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {job.error_msg ?? 'Site crawl failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <p className="text-sm text-[var(--keel-teal)]">
        Crawl complete · {job.urls_crawled.toLocaleString()} pages
      </p>
    );
  }

  const total = Math.max(job.url_limit, job.urls_discovered, 1);
  const percent = Math.min(
    100,
    Math.round((job.urls_crawled / total) * 100),
  );

  return (
    <div className="max-w-xl space-y-2 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {job.status === 'pending' ? 'Queued…' : 'Crawling internal links…'}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {job.urls_crawled.toLocaleString()} / {job.url_limit.toLocaleString()} pages
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
