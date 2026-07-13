import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runBillingDunningLifecycleCron } from '~/lib/billing/billing-lifecycle-cron';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Daily (09:00): past_due grace reminder → restricted → suspended → canceled.
 * Status transitions only — no account/data deletion.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await runBillingDunningLifecycleCron(admin);
    return jsonOk(result);
  } catch (err) {
    return jsonErr(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Dunning lifecycle cron failed',
      500,
    );
  }
}
