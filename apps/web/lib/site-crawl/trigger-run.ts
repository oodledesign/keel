import 'server-only';

import { delay } from '~/lib/clusters/utils';

import { SITE_CRAWL_WORKER_TRIGGER_DEBOUNCE_SEC } from './config';
import { getSiteCrawlJob, updateSiteCrawlJob } from './db';

const RUN_TIME_BUDGET_MS = 270_000;
const RUN_TRIGGER_ATTEMPTS = 3;

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

/**
 * Kick /run without waiting for it to finish — batches can take minutes.
 * Waiting with a short AbortSignal timed out and retried stacked workers.
 */
async function kickSiteCrawlRun(
  jobId: string,
  secret: string,
): Promise<boolean> {
  const url = getSiteCrawlRunUrl(jobId);

  for (let attempt = 1; attempt <= RUN_TRIGGER_ATTEMPTS; attempt += 1) {
    try {
      void fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      }).catch((error) => {
        console.error(
          '[rankly] site crawl run worker request failed',
          jobId,
          error,
        );
      });
      return true;
    } catch (error) {
      console.error(
        '[rankly] site crawl run trigger attempt failed',
        jobId,
        attempt,
        error,
      );
      if (attempt < RUN_TRIGGER_ATTEMPTS) {
        await delay(500 * attempt);
      }
    }
  }

  return false;
}

/**
 * Kick off the next worker invocation (used from after() and cron).
 */
export async function scheduleSiteCrawlContinuation(
  jobId: string,
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(
      '[rankly] CRON_SECRET missing; cannot trigger site crawl run',
    );
    return false;
  }

  await updateSiteCrawlJob(jobId, {
    last_worker_trigger_at: new Date().toISOString(),
  });

  return kickSiteCrawlRun(jobId, secret);
}

export async function triggerSiteCrawlRunDebounced(
  jobId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(
      '[rankly] CRON_SECRET missing; cannot trigger site crawl run',
    );
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

  return scheduleSiteCrawlContinuation(jobId);
}

/** Immediate worker trigger (new jobs). */
export function triggerSiteCrawlRun(jobId: string): void {
  void triggerSiteCrawlRunDebounced(jobId, { force: true });
}

export { RUN_TIME_BUDGET_MS };
