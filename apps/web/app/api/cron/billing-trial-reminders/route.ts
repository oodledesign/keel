import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runBillingTrialLifecycleCron } from '~/lib/billing/billing-lifecycle-cron';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Daily (08:00): trial day 7 / 3d / 1d / expired emails + trial_expired transition.
 * Uses Vercel Cron + CRON_SECRET (same pattern as other Ozer jobs).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await runBillingTrialLifecycleCron(admin);
    return jsonOk(result);
  } catch (err) {
    return jsonErr(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Trial lifecycle cron failed',
      500,
    );
  }
}
