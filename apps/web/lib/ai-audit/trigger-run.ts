import 'server-only';

const RUN_TIME_BUDGET_MS = 240_000;

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
 * Kick off AI audit on a dedicated worker invocation (same pattern as PageSpeed).
 * Avoids relying on Next.js `after()`, which often never runs under load.
 */
export function triggerAiAuditRun(jobId: string): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger AI audit run');
    return;
  }

  const url = getAiAuditRunUrl(jobId);
  void fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => {
    console.error('[rankly] trigger AI audit run failed', jobId, err);
  });
}

export { RUN_TIME_BUDGET_MS };
