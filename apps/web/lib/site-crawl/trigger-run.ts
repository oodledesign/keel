import 'server-only';

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

export function triggerSiteCrawlRun(jobId: string): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[rankly] CRON_SECRET missing; cannot trigger site crawl run');
    return;
  }

  const url = getSiteCrawlRunUrl(jobId);
  void fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => {
    console.error('[rankly] trigger site crawl run failed', jobId, err);
  });
}

export { RUN_TIME_BUDGET_MS };
