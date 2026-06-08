import 'server-only';

import { getRankCheckJob, updateRankCheckJob } from './db';
import { RANK_WORKER_TRIGGER_DEBOUNCE_SEC } from './queue-config';

export function getRankCheckRunUrl(jobId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (!base) {
    throw new Error(
      'Site URL not configured (NEXT_PUBLIC_SITE_URL or VERCEL_URL)',
    );
  }

  return `${base}/api/rankly/rank-check/${jobId}/run`;
}

/**
 * Enqueue a worker run, respecting a per-job debounce window so chained
 * invocations and UI polls do not stampede Vercel Functions.
 */
export async function triggerRankCheckRunDebounced(
  jobId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger rank check run');
    return false;
  }

  if (!options?.force) {
    try {
      const job = await getRankCheckJob(jobId);
      if (job.last_worker_trigger_at) {
        const elapsedMs =
          Date.now() - new Date(job.last_worker_trigger_at).getTime();
        if (elapsedMs < RANK_WORKER_TRIGGER_DEBOUNCE_SEC * 1000) {
          return false;
        }
      }
    } catch (error) {
      console.error('[rankly] debounce check failed', jobId, error);
      return false;
    }
  }

  await updateRankCheckJob(jobId, {
    last_worker_trigger_at: new Date().toISOString(),
  });

  const url = getRankCheckRunUrl(jobId);
  void fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => {
    console.error('[rankly] trigger rank check run failed', jobId, err);
  });

  return true;
}

/** Immediate worker trigger (new jobs, cron job creation). */
export function triggerRankCheckRun(jobId: string): void {
  void triggerRankCheckRunDebounced(jobId, { force: true });
}
