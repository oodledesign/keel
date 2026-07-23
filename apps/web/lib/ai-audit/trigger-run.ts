import 'server-only';

import { delay } from '~/lib/clusters/utils';

import { getAuditJob, markAuditWorkerTriggered } from './db';

/** Leave headroom under Vercel maxDuration=300s for response + cleanup. */
const RUN_TIME_BUDGET_MS = 240_000;

/** Minimum reserve so scoring gets a full invocation when citations finish late. */
export const AUDIT_SCORING_RESERVE_MS = 90_000;

/** Debounce concurrent poll-driven triggers for the same job. */
export const AUDIT_WORKER_TRIGGER_DEBOUNCE_MS = 30_000;

/** Only retry if the kickoff request itself fails to start (not while /run works). */
const RUN_TRIGGER_ATTEMPTS = 3;

export function getAiAuditRunUrl(jobId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (!base) {
    throw new Error(
      'Site URL not configured (NEXT_PUBLIC_SITE_URL or VERCEL_URL)',
    );
  }

  return `${base}/api/rankly/ai-audit/${jobId}/run`;
}

/**
 * Kick /run without waiting for it to finish — the worker can take minutes.
 * Waiting with a short AbortSignal timed out in production and logged false
 * errors on the status poll, then retried and stacked extra /run calls.
 */
async function kickAiAuditRun(
  jobId: string,
  secret: string,
): Promise<boolean> {
  const url = getAiAuditRunUrl(jobId);

  for (let attempt = 1; attempt <= RUN_TRIGGER_ATTEMPTS; attempt += 1) {
    try {
      void fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      }).catch((error) => {
        console.error(
          '[rankly] ai-audit run worker request failed',
          jobId,
          error,
        );
      });
      return true;
    } catch (error) {
      console.error(
        '[rankly] ai-audit run trigger attempt failed',
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
 * Kick off / continue AI audit on a dedicated worker invocation.
 * Avoids relying on Next.js `after()`, which often never runs under load —
 * though route handlers may still use `after()` as a best-effort chain.
 */
export async function scheduleAiAuditContinuation(
  jobId: string,
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger AI audit run');
    return false;
  }

  await markAuditWorkerTriggered(jobId);
  return kickAiAuditRun(jobId, secret);
}

export async function triggerAiAuditRunDebounced(
  jobId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger AI audit run');
    return false;
  }

  if (!options?.force) {
    try {
      const job = await getAuditJob(jobId);
      if (job.last_worker_trigger_at) {
        const elapsedMs =
          Date.now() - new Date(job.last_worker_trigger_at).getTime();
        if (
          !Number.isNaN(elapsedMs) &&
          elapsedMs >= 0 &&
          elapsedMs < AUDIT_WORKER_TRIGGER_DEBOUNCE_MS
        ) {
          return false;
        }
      }
    } catch (error) {
      console.error('[rankly] ai-audit debounce check failed', jobId, error);
      return false;
    }
  }

  return scheduleAiAuditContinuation(jobId);
}

/** Fire-and-forget worker trigger (new jobs / stuck pending). */
export function triggerAiAuditRun(jobId: string): void {
  void triggerAiAuditRunDebounced(jobId, { force: true });
}

export { RUN_TIME_BUDGET_MS };
