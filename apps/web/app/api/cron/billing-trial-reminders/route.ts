import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { runBillingTrialReminders } from '~/lib/billing/trial-notifications';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily: email workspace owners when trials end in 3 days, 1 day, or have ended. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runBillingTrialReminders(admin);

  return jsonOk(result);
}
