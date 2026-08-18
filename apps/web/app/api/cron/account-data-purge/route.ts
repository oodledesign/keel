import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { runAccountStoragePurgeCron } from '~/lib/retention/account-storage-purge';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Daily: warn owners 14 and 3 days before wipe, then purge storage at day 30.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await runAccountStoragePurgeCron(admin);
    return jsonOk(result);
  } catch (err) {
    return jsonErr(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Account data purge failed',
      500,
    );
  }
}
