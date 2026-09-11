import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isCronDisabled, cronSkippedResponse } from '~/lib/cron/cron-guards';
import { processDueDynamicsSyncJobs } from '~/lib/dynamics/sync.service';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Retries due Ozer → Dynamics contact upserts. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled()) {
    return cronSkippedResponse('all crons disabled');
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await processDueDynamicsSyncJobs(admin);
    return jsonOk(result);
  } catch (error) {
    console.error('[dynamics] contact sync cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Dynamics sync cron failed',
      500,
    );
  }
}
