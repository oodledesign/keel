import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runStuckThreadDigest } from '~/lib/email-assistant/stuck-thread-digest';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Weekly: stuck actionable email threads digest (email + in-app). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runStuckThreadDigest(admin);

  return jsonOk(result);
}
