import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { runPersonalPeopleReminders } from '~/lib/personal-people/personal-people-notifications';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily: catch-up and birthday/anniversary reminders for personal People. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runPersonalPeopleReminders(admin);

  return jsonOk(result);
}
