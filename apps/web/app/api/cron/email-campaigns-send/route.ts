import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { processDueCampaignSends } from '~/lib/campaigns/campaigns.service';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Starts due scheduled campaigns and continues in-flight sends. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const result = await processDueCampaignSends(admin);
    return jsonOk(result);
  } catch (error) {
    console.error('[campaigns] scheduled send cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Campaign send cron failed',
      500,
    );
  }
}
