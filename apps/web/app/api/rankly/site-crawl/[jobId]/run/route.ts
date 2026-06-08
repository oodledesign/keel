import { type NextRequest } from 'next/server';
import { after } from 'next/server';

import { runSiteCrawlJob } from '~/lib/site-crawl/runner';
import { scheduleSiteCrawlContinuation } from '~/lib/site-crawl/trigger-run';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function authorizeRun(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function continueSiteCrawlInBackground(jobId: string): Promise<void> {
  try {
    const secondBatch = await runSiteCrawlJob(jobId);
    if (secondBatch.completed) {
      return;
    }
  } catch (error) {
    console.error('[rankly] site-crawl after batch failed', jobId, error);
  }

  await scheduleSiteCrawlContinuation(jobId);
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeRun(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid run secret', 401);
  }

  try {
    const { jobId } = await context.params;
    const result = await runSiteCrawlJob(jobId);

    if (!result.completed) {
      after(() => {
        void continueSiteCrawlInBackground(jobId);
      });
    }

    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] site-crawl run POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Site crawl run failed',
      500,
    );
  }
}
