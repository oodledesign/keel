import 'server-only';

const RUN_TIME_BUDGET_MS = 240_000;

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

export function triggerRankCheckRun(jobId: string): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger rank check run');
    return;
  }

  const url = getRankCheckRunUrl(jobId);
  void fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => {
    console.error('[rankly] trigger rank check run failed', jobId, err);
  });
}

export { RUN_TIME_BUDGET_MS };
