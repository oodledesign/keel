import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { cronSkippedResponse, isCronDisabled } from '~/lib/cron/cron-guards';
import { runProjectRetainerWeeklyDigest } from '~/lib/retainers/weekly-digest';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Weekly: project retainer credit digest (Europe/London week). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled()) {
    return cronSkippedResponse('crons disabled');
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runProjectRetainerWeeklyDigest(admin);

  return jsonOk(result);
}
