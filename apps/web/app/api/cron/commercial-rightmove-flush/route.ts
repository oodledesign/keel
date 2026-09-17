import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { processRightmoveFlushBatch } from '~/lib/commercial/rightmove-flush-job';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Flush Unsynced live Rightmove listings (never first-time Not pushed). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await processRightmoveFlushBatch({
    client: admin as never,
    limit: 20,
    delayMs: 300,
  });

  return jsonOk(result);
}
