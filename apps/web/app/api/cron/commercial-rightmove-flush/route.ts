import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { processRightmoveFlushBatch } from '~/lib/commercial/rightmove-flush-job';
import { reconcileOffMarketRightmove } from '~/lib/commercial/rightmove-off-market-reconcile';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Every 15 minutes: take off-market disposals off Rightmove, then flush
 * Unsynced live listings (never first-time Not pushed).
 * `?dryRun=1` only lists what would be removed.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();

  if (new URL(request.url).searchParams.get('dryRun') === '1') {
    const preview = await reconcileOffMarketRightmove({
      client: admin as never,
      dryRun: true,
    });
    return jsonOk({ offMarket: preview });
  }

  // A failure here must not stop the normal flush.
  const offMarket = await reconcileOffMarketRightmove({
    client: admin as never,
    limit: 15,
    delayMs: 300,
  }).catch((error: unknown) => ({
    found: 0,
    removed: 0,
    failed: 0,
    lastError: error instanceof Error ? error.message : String(error),
  }));

  const result = await processRightmoveFlushBatch({
    client: admin as never,
    limit: 20,
    delayMs: 300,
  });

  return jsonOk({ ...result, offMarket });
}
