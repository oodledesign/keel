import { type NextRequest } from 'next/server';

import { runSiteCrawlJob } from '~/lib/site-crawl/runner';
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

export async function POST(request: NextRequest, context: RouteContext) {
  if (!authorizeRun(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid run secret', 401);
  }

  try {
    const { jobId } = await context.params;
    const result = await runSiteCrawlJob(jobId);
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
