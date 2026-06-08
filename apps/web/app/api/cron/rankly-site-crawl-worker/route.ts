import { type NextRequest } from 'next/server';

import { sweepSiteCrawlWorkers } from '~/lib/site-crawl/runner';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/** Resumes stalled site crawls with debounced worker triggers. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await sweepSiteCrawlWorkers();
    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] site-crawl worker cron', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Worker cron failed',
      500,
    );
  }
}
