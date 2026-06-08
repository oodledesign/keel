import 'server-only';

import { getSiteCrawlJob, updateSiteCrawlJob } from './db';
import { SITE_CRAWL_WORKER_TRIGGER_DEBOUNCE_SEC } from './config';

const RUN_TIME_BUDGET_MS = 240_000;

export function getSiteCrawlRunUrl(jobId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (!base) {
    throw new Error(
      'Site URL not configured (NEXT_PUBLIC_SITE_URL or VERCEL_URL)',
    );
  }

  return `${base}/api/rankly/site-crawl/${jobId}/run`;
}

export async function triggerSiteCrawlRunDebounced(
  jobId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger site crawl run');
    return false;
  }

  if (!options?.force) {
    try {
      const job = await getSiteCrawlJob(jobId);
      if (job.last_worker_trigger_at) {
        const elapsedMs =
          Date.now() - new Date(job.last_worker_trigger_at).getTime();
        if (elapsedMs < SITE_CRAWL_WORKER_TRIGGER_DEBOUNCE_SEC * 1000) {
          return false;
        }
      }
    } catch (error) {
      console.error('[rankly] site crawl debounce check failed', jobId, error);
      return false;
    }
  }

  await updateSiteCrawlJob(jobId, {
    last_worker_trigger_at: new Date().toISOString(),
  });

  const url = getSiteCrawlRunUrl(jobId);
  void fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => {
    console.error('[rankly] trigger site crawl run failed', jobId, err);
  });

  return true;
}

/** Immediate worker trigger (new jobs). */
export function triggerSiteCrawlRun(jobId: string): void {
  void triggerSiteCrawlRunDebounced(jobId, { force: true });
}

export { RUN_TIME_BUDGET_MS };
