import { type NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { runRankCheckJob } from '~/lib/rank-tracking/runner';

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
    const result = await runRankCheckJob(jobId);
    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] rank-check run POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Rank check run failed',
      500,
    );
  }
}
