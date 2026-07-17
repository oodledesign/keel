import { type NextRequest } from 'next/server';

import {
  CRON_KILL_SWITCH,
  cronSkippedResponse,
  isCronDisabled,
} from '~/lib/cron/cron-guards';
import { sweepRankCheckWorkers } from '~/lib/rank-tracking/runner';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/** Sweeps pending rank-check tasks and debounces worker invocations. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled(CRON_KILL_SWITCH.RANKLY)) {
    return cronSkippedResponse('rankly-rank-check-worker disabled');
  }

  try {
    const result = await sweepRankCheckWorkers();
    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] rank-check worker cron', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Worker cron failed',
      500,
    );
  }
}
