import 'server-only';

import { delay } from '~/lib/clusters/utils';
import { getAppSiteOrigin } from '~/lib/app-host-routing';

import { getRankCheckJob, updateRankCheckJob } from './db';
import { RANK_WORKER_TRIGGER_DEBOUNCE_SEC } from './queue-config';

const RUN_TRIGGER_ATTEMPTS = 4;
const RUN_TRIGGER_TIMEOUT_MS = 20_000;

export function getRankCheckRunUrl(jobId: string): string {
  const base = getAppSiteOrigin().replace(/\/$/, '');

  if (!base) {
    throw new Error('App site origin not configured');
  }

  return `${base}/api/rankly/rank-check/${jobId}/run`;
}

async function postRankCheckRunWithRetry(
  jobId: string,
  secret: string,
): Promise<boolean> {
  const url = getRankCheckRunUrl(jobId);

  for (let attempt = 1; attempt <= RUN_TRIGGER_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(RUN_TRIGGER_TIMEOUT_MS),
      });

      if (response.ok) {
        return true;
      }

      const body = await response.text().catch(() => '');
      console.error(
        '[rankly] rank check run trigger bad status',
        jobId,
        response.status,
        body.slice(0, 200),
        attempt,
      );
    } catch (error) {
      console.error(
        '[rankly] rank check run trigger attempt failed',
        jobId,
        attempt,
        error,
      );
    }

    if (attempt < RUN_TRIGGER_ATTEMPTS) {
      await delay(1500 * attempt);
    }
  }

  return false;
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

  return postRankCheckRunWithRetry(jobId, secret);
}

/** Immediate worker trigger (new jobs, cron job creation). */
export function triggerRankCheckRun(jobId: string): void {
  void triggerRankCheckRunDebounced(jobId, { force: true });
}
