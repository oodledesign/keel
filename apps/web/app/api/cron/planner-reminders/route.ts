import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runPlannerRemindersDispatch } from '~/lib/planner/planner-reminders-dispatch';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Every 5 minutes: dispatch due planner block reminders via Web Push. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runPlannerRemindersDispatch(admin);

  return jsonOk(result);
}
